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

/** Render arbitrary lines with the rules that apply to a given path — for the broken variants,
 * which are edits a scene makes rather than files on disk. */
function renderText(rules: Rule[], relativePath: string, lines: string[]): string[] {
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
    assert.deepStrictEqual(folders.sort(), [
      "1-replace",
      "2-caret",
      "3-invisible-markers",
      "4-hide-markup",
      "fixtures",
    ]);
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

  test("1 draws the glyphs prettify-symbols-mode draws", () => {
    const lines = render(rules, "examples/1-replace/lambda.el");
    assert.strictEqual(lines[0], "(λ (x) (≥ x 0))");
  });

  test("1 draws a glyph per tag", () => {
    const lines = render(rules, "examples/1-replace/tags.md");
    assert.strictEqual(lineContaining(lines, "Ship"), "- ✅ Ship the fork");
    assert.strictEqual(lineContaining(lines, "gutter"), "- 🐞 Fix the gutter");
  });

  test("1 draws a glyph per fat arrow", () => {
    const lines = render(rules, "examples/1-replace/arrows.ts");
    assert.strictEqual(lineContaining(lines, "sq"), "const sq = (n: N) ⇒ n * n;");
  });

  test("1 draws a glyph per TeX command, and nothing for what is not in the table", () => {
    const lines = render(rules, "examples/1-replace/math.tex");
    assert.strictEqual(lineContaining(lines, "∀"), "∀ x ∈ \\mathbb{R}");
    assert.strictEqual(lineContaining(lines, "α"), "α + β = γ");
    assert.strictEqual(lineContaining(lines, "→"), "x → y");
  });

  test("2 conceals the same tags and glyphs its own copies carry", () => {
    assert.deepStrictEqual(
      render(rules, "examples/2-caret/tags.md"),
      render(rules, "examples/1-replace/tags.md"),
      "the caret scenes demonstrate the same rules as the replace ones",
    );
    assert.deepStrictEqual(
      render(rules, "examples/2-caret/lambda.el"),
      render(rules, "examples/1-replace/lambda.el"),
    );
    assert.deepStrictEqual(
      render(rules, "examples/2-caret/math.tex"),
      render(rules, "examples/1-replace/math.tex"),
    );
  });

  test("3 hides an identity marker on a list item and on a paragraph alike", () => {
    const lines = render(rules, "examples/3-invisible-markers/notes.md");
    assert.strictEqual(lineContaining(lines, "Buy milk"), "- Buy milk");
    assert.strictEqual(lineContaining(lines, "Call Ann"), "Call Ann");
  });

  test("3 draws the tags beside the markers it hides", () => {
    const lines = render(rules, "examples/3-invisible-markers/notes.md");
    assert.strictEqual(lineContaining(lines, "Ship"), "- ✅ Ship it");
    assert.strictEqual(lineContaining(lines, "Fix"), "🐞 Fix it");
  });

  test("3 leaves a marker that starts neither a line nor an item alone", () => {
    const moved = renderText(rules, "examples/3-invisible-markers/notes.md", [
      "Bread {ID:K71QMX} Buy milk",
    ]);
    assert.strictEqual(moved[0], "Bread {ID:K71QMX} Buy milk", "a marker off the record's start shows");
  });

  test("4 unquotes JSON keys and string values alike", () => {
    const lines = render(rules, "examples/4-hide-markup/config.json");
    assert.strictEqual(lineContaining(lines, "name"), "  name: demo,");
    assert.strictEqual(lineContaining(lines, "count"), "  count: 12");
  });

  test("4 leaves an orphaned quote visible when its partner is gone", () => {
    const orphan = renderText(rules, "examples/4-hide-markup/config.json", [
      "{",
      '  "name: "demo",',
      "}",
    ]);
    assert.strictEqual(orphan[1], '  "name: demo,', "the key's opening quote has no partner");
  });

  test("4 removes markdown syntax and leaves the words", () => {
    const lines = render(rules, "examples/4-hide-markup/emphasis.md");
    assert.strictEqual(lineContaining(lines, "Bold"), "Bold, italic, code.");
  });

  test("4 leaves an orphaned delimiter visible when its partner is gone", () => {
    const orphan = renderText(rules, "examples/4-hide-markup/emphasis.md", [
      "Bold**, _italic_, `code`.",
    ]);
    assert.strictEqual(orphan[0], "Bold**, italic, code.");
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
