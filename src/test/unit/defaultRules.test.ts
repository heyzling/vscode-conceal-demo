import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { spansForLines } from "../../matcher";
import { Rule, normalizeRules } from "../../rules";
import { decorationKey } from "../../decorationKey";

const ROOT = path.join(__dirname, "..", "..", "..");
const SETTING = "conceal-demo.exampleRules";

function readJson(...parts: string[]): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(ROOT, ...parts), "utf8"));
}

/** Enough of a glob to decide which of the shipped rules a given example file is for. The editor
 * does this itself at runtime; here it only has to agree with the patterns actually used. */
function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const body = escaped
    .split("**")
    .map((part) => part.replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]"))
    .join(".*");
  return new RegExp(`^${body}$`);
}

function shippedRules(): Rule[] {
  const document = readJson("examples", "default-rules.json");
  const { rules, problems } = normalizeRules(document[SETTING], "example");
  assert.deepStrictEqual(problems, [], "every shipped rule must be runnable");
  return rules;
}

function rulesFor(rules: Rule[], relativePath: string): Rule[] {
  return rules.filter((rule) =>
    (rule.files ?? []).some((glob) => globToRegExp(glob).test(relativePath)),
  );
}

/** What the editor draws for a file: hidden text removed, replacements in its place. */
function render(rules: Rule[], relativePath: string): string[] {
  const lines = fs.readFileSync(path.join(ROOT, relativePath), "utf8").split(/\r\n|\r|\n/);
  const spans = spansForLines(rulesFor(rules, relativePath), lines, {
    remaining: 10_000,
    exhausted: false,
  });
  const rendered = [...lines];
  for (const span of [...spans].reverse()) {
    const line = rendered[span.line];
    rendered[span.line] = line.slice(0, span.start) + span.replacement + line.slice(span.end);
  }
  return rendered;
}

function lineContaining(lines: string[], needle: string): string {
  const found = lines.find((line) => line.includes(needle));
  assert.ok(found !== undefined, `no rendered line contains ${JSON.stringify(needle)}`);
  return found;
}

suite("shipped example rules", () => {
  const rules = shippedRules();

  test("package.json's default is a copy of examples/default-rules.json", () => {
    const manifest = readJson("package.json") as {
      contributes: { configuration: { properties: Record<string, { default: unknown }> } };
    };
    const document = readJson("examples", "default-rules.json");
    assert.deepStrictEqual(
      manifest.contributes.configuration.properties[SETTING].default,
      document[SETTING],
      "run `npm run sync-example-rules`",
    );
  });

  test("every rule names the files it is for, so nothing fires by accident", () => {
    for (const rule of rules) {
      assert.ok(rule.files && rule.files.length > 0, `${rule.id} has no files glob`);
    }
  });

  test("every example folder has at least one rule", () => {
    const folders = fs
      .readdirSync(path.join(ROOT, "examples"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name);
    assert.deepStrictEqual(folders.sort(), ["1-hide", "2-replace", "6-not-implemented", "fixtures"]);
    for (const folder of folders) {
      const matching = rules.filter((rule) =>
        (rule.files ?? []).some((glob) => glob.includes(folder)),
      );
      assert.ok(matching.length > 0, `${folder} has no rules`);
    }
  });

  test("every scene names an example file that exists", () => {
    const scenes = readJson("examples", "scenes.json") as { scenes: { example: string }[] };
    for (const scene of scenes.scenes) {
      assert.ok(
        fs.existsSync(path.join(ROOT, "examples", scene.example)),
        `no example file at ${scene.example}`,
      );
    }
  });

  test("11 removes markdown syntax and leaves the words", () => {
    const lines = render(rules, "examples/1-hide/11-md-markup.md");
    assert.strictEqual(lineContaining(lines, "Bold"), "Bold, italic, code.");
  });

  test("12 hides an identity marker outright", () => {
    const lines = render(rules, "examples/1-hide/12-example-id-md.md");
    assert.strictEqual(lineContaining(lines, "Buy milk"), "- Buy milk");
    assert.strictEqual(lineContaining(lines, "Go home"), "- Go home");
  });

  test("13 hides a block anchor and leaves the sentence", () => {
    const lines = render(rules, "examples/1-hide/13-obsidian-block-id.md");
    assert.strictEqual(lineContaining(lines, "anchored"), "An anchored line.");
  });

  test("21 draws a glyph per tag", () => {
    const lines = render(rules, "examples/2-replace/21-tag-to-icon.md");
    assert.strictEqual(lineContaining(lines, "Ship"), "- ✅ Ship the fork");
    assert.strictEqual(lineContaining(lines, "gutter"), "- 🐞 Fix the gutter");
  });

  test("22 draws a glyph per TeX command and leaves the rest", () => {
    const lines = render(rules, "examples/2-replace/22-latex-formula.tex");
    assert.strictEqual(lines[0], "∀ x ∈ \\mathbb{R}");
    assert.strictEqual(lines[1], "α + β = γ");
  });

  test("23 draws what prettify-symbols-mode draws", () => {
    const lines = render(rules, "examples/2-replace/23-lisp-lambda.el");
    assert.strictEqual(lines[0], "(λ (x) (≥ x 0))");
    assert.strictEqual(lines[1], "(λ (y) (√ y))");
  });

  test("24 builds a different string per occurrence", () => {
    const lines = render(rules, "examples/2-replace/24-writer-scene-syntax.md");
    assert.strictEqual(lineContaining(lines, "icons"), "# ▲2 ⌁3 Writer scene icons");
    assert.strictEqual(lineContaining(lines, "lighthouse"), "## ⟲1 ▲3 ⌁10 The lighthouse");
    assert.strictEqual(lineContaining(lines, "ferry"), "## ⟲2 ▲1 ⌁7 The ferry");
  });

  test("24 costs one decoration type per distinct string drawn", () => {
    const applicable = rulesFor(rules, "examples/2-replace/24-writer-scene-syntax.md");
    const lines = fs
      .readFileSync(path.join(ROOT, "examples/2-replace/24-writer-scene-syntax.md"), "utf8")
      .split("\n");
    const spans = spansForLines(applicable, lines, { remaining: 10_000, exhausted: false });
    const keys = new Set(
      spans.map((span) =>
        decorationKey({
          replacement: span.replacement,
          cursorStop: span.rule.cursorStop,
          style: span.rule.style,
        }),
      ),
    );
    assert.strictEqual(applicable.length, 3, "three rules");
    assert.ok(keys.size > applicable.length, `expected more types than rules, got ${keys.size}`);
  });

  test("25 masks a value at its own width, right up to the cap", () => {
    const lines = render(rules, "examples/2-replace/25-password-mask.env");
    assert.strictEqual(lines[0], `API_TOKEN=${"•".repeat(16)}`, "sixteen is the cap exactly");
    assert.strictEqual(lines[1], "LOG_LEVEL=•••••");
  });

  test("hiding a property line's text leaves the line", () => {
    const logseq = render(rules, "examples/6-not-implemented/61-logseq-properties.md");
    assert.strictEqual(logseq[3], "", "id:: leaves an empty row");
    assert.strictEqual(logseq[4], "", "collapsed:: leaves an empty row");
    assert.strictEqual(logseq[5], "- Ship the fork");

    const org = render(rules, "examples/6-not-implemented/62-org-properties.org");
    assert.deepStrictEqual(org.slice(0, 6), ["* Buy milk", "", "", "", "", "Milk, and nothing else."]);
  });

  test("a per-occurrence replacement costs one decoration type per distinct string", () => {
    const applicable = rulesFor(rules, "examples/fixtures/types.md");
    const lines = fs
      .readFileSync(path.join(ROOT, "examples/fixtures/types.md"), "utf8")
      .split("\n");
    const spans = spansForLines(applicable, lines, { remaining: 10_000, exhausted: false });
    const keys = new Set(
      spans.map((span) =>
        decorationKey({
          replacement: span.replacement,
          cursorStop: span.rule.cursorStop,
          style: span.rule.style,
        }),
      ),
    );
    assert.strictEqual(applicable.length, 3, "three rules");
    assert.ok(
      keys.size > applicable.length,
      `expected more decoration types than rules, got ${keys.size}`,
    );
  });

  test("a chip wider than the editor's cap is cut at 16 characters", () => {
    const lines = render(rules, "examples/fixtures/cap.md");
    const chip = lineContaining(lines, "▸");
    assert.strictEqual(chip, "▸ #todo !#done ·", "`▸ #todo !#done · 20` is 19 characters");
    assert.strictEqual(Array.from(chip).length, 16);
  });

  test("masking pads to the hidden value's width, up to the same cap", () => {
    const lines = render(rules, "examples/fixtures/mask.env");
    assert.strictEqual(lineContaining(lines, "LOG_LEVEL"), "LOG_LEVEL=•••••");
    assert.strictEqual(lineContaining(lines, "API_TOKEN"), `API_TOKEN=${"•".repeat(16)}`);
  });
});
