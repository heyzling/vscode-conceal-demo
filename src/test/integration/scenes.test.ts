import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { play, press, type Expect, type Probe, type Scene, type Script, type Step } from "../../recorder";
import { concealAvailable } from "./conceal";

/**
 * Every scene behind the README's GIFs, played by the recorder with nothing photographed: a step's
 * `expect` says what its frame shows, in the scene's own 1-based lines and columns. Skipped where
 * the conceal API is absent, since every expectation is about it.
 */
const SCENES = path.join(__dirname, "../../../examples/scenes.jsonc");
const SETTLE_MS = 150;
// CONCEAL_DEMO_TRACE=1 prints every frame's carets and their lines: what a new scene's `expect` is written from.

/** The editor settings of the recording profile that decide what a keystroke does; see record.sh. */
const RECORDING_PROFILE: Record<string, unknown> = {
  "editor.wordWrap": "wordWrapColumn",
  "editor.wordWrapColumn": 28,
  "editor.autoClosingBrackets": "never",
  "editor.autoSurround": "never",
};

/** scenes.jsonc as record.sh reads it: comments and trailing commas go, string contents stay. */
function parseJsonc(text: string): Script {
  const outside = (match: string): string => (match.startsWith('"') ? match : "");
  const stripped = text.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, outside);
  return JSON.parse(stripped.replace(/"(?:\\.|[^"\\])*"|,(?=\s*[}\]])/g, outside));
}

function exampleOf(scene: Scene): vscode.TextDocument {
  const document = vscode.workspace.textDocuments.find((candidate) => candidate.uri.path.endsWith(`/${scene.example}`));
  assert.ok(document, `${scene.example} is not open`);
  return document;
}

function oneBased(position: vscode.Position): [number, number] {
  return [position.line + 1, position.character + 1];
}

function at([line, column]: [number, number]): vscode.Position {
  return new vscode.Position(line - 1, column - 1);
}

async function check(expect: Expect, example: vscode.TextDocument, previous: string, where: string): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  assert.ok(editor, `${where}: no active editor`);
  if (expect.caret) {
    const carets = typeof expect.caret[0] === "number" ? [expect.caret as [number, number]] : (expect.caret as [number, number][]);
    assert.deepStrictEqual(editor.selections.map((selection) => oneBased(selection.active)), carets, `${where}: caret`);
  }
  if (expect.selection) {
    const { anchor, active } = editor.selection;
    assert.deepStrictEqual([...oneBased(anchor), ...oneBased(active)], expect.selection, `${where}: selection`);
  }
  for (const [line, text] of Object.entries(expect.lines ?? {})) {
    assert.strictEqual(example.lineAt(Number(line) - 1).text, text, `${where}: line ${line}`);
  }
  if (expect.beside !== undefined) {
    assert.ok(editor.document.isUntitled, `${where}: the untitled document is not active`);
    assert.strictEqual(editor.document.getText(), expect.beside, `${where}: beside`);
  }
  if (expect.unchanged) {
    assert.strictEqual(example.getText(), previous, `${where}: changed`);
  }
  // Last: putting the caret back can itself move it out of a range it sat inside.
  const probes = expect.press && typeof expect.press[0] === "string" ? [expect.press as Probe] : (expect.press as Probe[] | undefined);
  for (const [command, from, to] of probes ?? []) {
    const selections = editor.selections;
    editor.selection = new vscode.Selection(at(from), at(from));
    await press(command, [], false);
    assert.deepStrictEqual(oneBased(editor.selection.active), to, `${where}: ${command} at ${from}`);
    editor.selections = selections;
  }
}

/** Runs a scene, checking every frame that has an expectation. */
async function verify(scene: Scene): Promise<void> {
  let previous = fs.readFileSync(path.join(path.dirname(SCENES), scene.example), "utf8");
  let current: Step | undefined;
  let frames = 0;
  // A keystroke that changed nothing is what some steps show; the expectations tell that from a lost one.
  await play(scene, SETTLE_MS, async (step, live) => {
    frames = step === current ? frames + 1 : 0;
    current = step;
    const where = `${scene.id} "${step.caption ?? ""}" frame ${frames}`;
    const example = exampleOf(scene);
    if (process.env.CONCEAL_DEMO_TRACE) {
      const editor = vscode.window.activeTextEditor;
      const carets = editor?.selections.map((selection) => [...oneBased(selection.anchor), ...oneBased(selection.active)]);
      const lines = editor?.selections.map((selection) => editor.document.lineAt(selection.active.line).text);
      console.log(`${where}: ${JSON.stringify({ carets, lines })}`);
    }
    if (!live && Array.isArray(step.expect)) {
      assert.strictEqual(step.expect.length, frames + 1, `${where}: one expectation per frame`);
    }
    const expect = Array.isArray(step.expect) ? step.expect[frames] : live ? undefined : step.expect;
    if (expect) {
      await check(expect, example, previous, where);
    }
    if (!live) {
      previous = example.getText();
    }
  }, false);
}

suite("scenes", () => {
  const script = parseJsonc(fs.readFileSync(SCENES, "utf8"));
  const original = new Map<string, unknown>();
  let available = false;

  suiteSetup(async () => {
    available = concealAvailable();
    if (!available) {
      return;
    }
    const configuration = vscode.workspace.getConfiguration();
    for (const [key, value] of Object.entries(RECORDING_PROFILE)) {
      original.set(key, configuration.inspect(key)?.globalValue);
      await configuration.update(key, value, vscode.ConfigurationTarget.Global);
    }
  });

  suiteTeardown(async () => {
    for (const [key, value] of original) {
      await vscode.workspace.getConfiguration().update(key, value, vscode.ConfigurationTarget.Global);
    }
  });

  for (const scene of script.scenes) {
    test(`${scene.id} — ${scene.title ?? ""}`, async function () {
      if (!available) {
        this.skip();
      }
      this.timeout(120_000);
      await verify(scene);
    });
  }
});
