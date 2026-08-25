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
      .filter((entry) => entry.isDirectory() && /^\d\d-/.test(entry.name))
      .map((entry) => entry.name);
    assert.strictEqual(folders.length, 8);
    for (const folder of folders) {
      const matching = rules.filter((rule) =>
        (rule.files ?? []).some((glob) => glob.includes(folder)),
      );
      assert.ok(matching.length > 0, `${folder} has no rules`);
    }
  });

  test("G1 removes markdown syntax and leaves the words", () => {
    const lines = render(rules, "examples/01-syntax-elision/emphasis.md");
    assert.strictEqual(
      lineContaining(lines, "takes a run of text"),
      "The conceal API takes a run of text out of the view, never out of the file.",
    );
  });

  test("G1 leaves a link's description and hides its target", () => {
    const lines = render(rules, "examples/01-syntax-elision/links.md");
    assert.strictEqual(
      lineContaining(lines, "Q4 report"),
      "See the Q4 report for the numbers, and",
    );
  });

  test("G1 unquotes JSON keys and leaves string values alone", () => {
    const lines = render(rules, "examples/01-syntax-elision/config.json");
    assert.strictEqual(lineContaining(lines, "conceal-demo"), '  name: "conceal-demo",');
    assert.strictEqual(lineContaining(lines, '"a"'), '  list: ["a", "b"]');
  });

  test("G2 draws one glyph per token", () => {
    const lines = render(rules, "examples/02-symbol-substitution/math.tex");
    assert.strictEqual(lineContaining(lines, "∀"), "∀ x ∈ \\mathbb{R}: α x^2 + β x + γ = 0");
  });

  test("G3 hides an identity marker outright", () => {
    const lines = render(rules, "examples/03-machine-metadata/notes.md");
    assert.strictEqual(lineContaining(lines, "Buy milk"), "## #todo Buy milk");
  });

  test("G3 draws a badge in the variant that asks for one", () => {
    const lines = render(rules, "examples/03-machine-metadata/notes-badge.md");
    assert.strictEqual(lineContaining(lines, "Buy milk"), "## °#todo Buy milk");
  });

  test("G3 shortens a long opaque id", () => {
    const lines = render(rules, "examples/03-machine-metadata/store-paths.md");
    assert.strictEqual(
      lineContaining(lines, "hello").trim(),
      "/nix/store/…-hello-2.12.1/bin/hello",
    );
  });

  test("G4 draws a different string per occurrence", () => {
    const lines = render(rules, "examples/04-semantic-projection/scenes.md");
    assert.strictEqual(lineContaining(lines, "lighthouse"), "## ⟲1 ▲3 ⌁10 The lighthouse");
    assert.strictEqual(lineContaining(lines, "harbour"), "## ⟲1 ▲2 ⌁137 The harbour");
  });

  test("G4 costs one decoration type per distinct string drawn", () => {
    const applicable = rulesFor(rules, "examples/04-semantic-projection/scenes.md");
    const lines = fs
      .readFileSync(path.join(ROOT, "examples/04-semantic-projection/scenes.md"), "utf8")
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

  test("G5 keeps the first class and folds the rest", () => {
    const lines = render(rules, "examples/05-bulk-collapse/tailwind.html");
    assert.strictEqual(lineContaining(lines, "card").trim(), '<div class="card …">');
  });

  test("G6 masks a value to the editor's cap, not to the value's width", () => {
    const lines = render(rules, "examples/06-redaction/secrets.env");
    assert.strictEqual(lineContaining(lines, "API_TOKEN"), `API_TOKEN=${"•".repeat(16)}`);
    assert.strictEqual(lineContaining(lines, "LOG_LEVEL"), "LOG_LEVEL=•••••");
  });

  test("G7 draws a fence chip, and the editor's cap cuts it", () => {
    const lines = render(rules, "examples/07-line-elision/fences.md");
    assert.strictEqual(lineContaining(lines, "▸"), "▸ #todo !#done ·");
    assert.strictEqual(Array.from(lineContaining(lines, "▸")).length, 16);
  });

  test("G7 hiding a whole line's text leaves the line", () => {
    const lines = render(rules, "examples/07-line-elision/frontmatter.md");
    assert.strictEqual(lines[1], "");
    assert.strictEqual(lines[2], "");
    assert.strictEqual(lines[5], "---");
  });

  test("G8 hides markers and draws tag glyphs", () => {
    const lines = render(rules, "examples/08-interaction/caret-playground.md");
    assert.strictEqual(lineContaining(lines, "Crossing"), "## Crossing");
    assert.ok(lineContaining(lines, "✅").includes("✅"));
  });
});
