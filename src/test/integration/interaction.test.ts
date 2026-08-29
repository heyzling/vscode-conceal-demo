import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";
import { ConcealDemoApi } from "../../extension";

/**
 * What the *editor* provides, exercised through real commands rather than described.
 *
 * None of this is implementable by an extension: where a caret lands, what a delete takes and
 * which characters a selection covers are decided below the API. The suite is skipped where there
 * is no conceal API, because there is then nothing to measure.
 *
 * Two fixtures, three known lines each:
 *
 *   line 0: `## {!A3BF9Z} fixture line one`   — `[3, 13)` hidden outright
 *   line 1: `plain #done tail`                — `[6, 11)` drawn as ✅, so it has two sides
 *   line 2: `prefix (fold:hidden) tail`       — `[7, 20)` drawn as …, revealed when adjacent
 *
 * `fixture.md` conceals line 0 with `cursorStop: "before"` and `fixture-after.md` with `"after"`.
 * That is the whole difference, and the tests below are mostly about what it decides.
 */
const MARKER_START = 3;
const MARKER_END = 13;
const TAG_START = 6;
const TAG_END = 11;
const LINE_0 = "## {!A3BF9Z} fixture line one";

suite("interaction", () => {
  let api: ConcealDemoApi;

  /** A fresh editor every time: showing a second document in the same column retires the first
   * one's `TextEditor`, and a retired handle reports the selection it had when it was replaced. */
  async function openFixture(name: string): Promise<vscode.TextEditor> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder);
    const uri = vscode.Uri.file(path.join(folder.uri.fsPath, `fixtures/${name}`));
    const editor = await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
    api.refresh();
    return editor;
  }

  suiteSetup(async function () {
    const extension = vscode.extensions.getExtension<ConcealDemoApi>("heyzling.conceal-demo");
    assert.ok(extension);
    api = await extension.activate();
    if (api.availability.kind !== "available") {
      this.skip();
    }
  });

  teardown(async () => {
    if (vscode.window.activeTextEditor?.document.isDirty) {
      await vscode.commands.executeCommand("workbench.action.files.revert");
    }
    api.refresh();
  });

  /** An extension host holds a *copy* of the selection and of the document, refreshed by events.
   * Every assertion here is about what the editor decided, so each step waits for the event that
   * carries the decision back rather than reading the copy it set itself. */
  function once<T>(
    event: vscode.Event<T>,
    timeoutMs: number,
    predicate: (value: T) => boolean = () => true,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        subscription.dispose();
        resolve();
      }, timeoutMs);
      const subscription = event((value) => {
        if (!predicate(value)) {
          return;
        }
        clearTimeout(timer);
        subscription.dispose();
        resolve();
      });
    });
  }

  const settle = (): Promise<void> => once(vscode.window.onDidChangeTextEditorSelection, 500);

  /** A keystroke that moves the caret. */
  async function press(command: string, arg?: unknown): Promise<void> {
    const moved = settle();
    await vscode.commands.executeCommand(command, arg);
    await moved;
  }

  /** A keystroke that changes the document. */
  async function keyEdit(command: string, arg?: unknown): Promise<void> {
    const changed = once(
      vscode.workspace.onDidChangeTextDocument,
      1500,
      (event) => event.contentChanges.length > 0,
    );
    await vscode.commands.executeCommand(command, arg);
    await changed;
  }

  async function put(editor: vscode.TextEditor, line: number, character: number): Promise<void> {
    const position = new vscode.Position(line, character);
    editor.selection = new vscode.Selection(position, position);
    await settle();
  }

  function live(): vscode.TextEditor {
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor, "no active editor");
    return editor;
  }

  function caret(): number {
    return live().selection.active.character;
  }

  function line0(): string {
    return live().document.lineAt(0).text;
  }

  test('a "before" range collapses to its start, and its end cannot be reached', async () => {
    await put(await openFixture("fixture.md"), 0, MARKER_END);
    assert.strictEqual(caret(), MARKER_START);
  });

  test('an "after" range collapses to its end, and its start cannot be reached', async () => {
    await put(await openFixture("fixture-after.md"), 0, MARKER_START);
    assert.strictEqual(caret(), MARKER_END);
  });

  test("crossing a fully hidden range therefore costs no keypress at all", async () => {
    await put(await openFixture("fixture.md"), 0, MARKER_END);
    await press("cursorLeft");
    assert.strictEqual(caret(), MARKER_START - 1, "one step left of the collapse point");
    await press("cursorRight");
    assert.strictEqual(caret(), MARKER_START, "and one step back onto it");
  });

  test("word motion never lands inside a hidden range", async () => {
    await put(await openFixture("fixture.md"), 0, MARKER_END);
    await press("cursorWordLeft");
    assert.ok(caret() <= MARKER_START || caret() >= MARKER_END, `word-left landed at ${caret()}`);
  });

  test("a drawn replacement has a stop on each side, so it takes two presses to cross", async () => {
    await put(await openFixture("fixture.md"), 1, TAG_END + 1);
    await press("cursorLeft");
    assert.strictEqual(caret(), TAG_END, "right side of the glyph");
    await press("cursorLeft");
    assert.strictEqual(caret(), TAG_START, "left side of the glyph");
  });

  test("a position handed to the editor inside a hidden range is normalised out of it", async () => {
    await put(await openFixture("fixture.md"), 0, MARKER_START + 4);
    assert.ok(caret() <= MARKER_START || caret() >= MARKER_END, `caret rested at ${caret()}`);
  });

  test("delete takes the whole range whenever a key reaches into it", async () => {
    await put(await openFixture("fixture.md"), 0, MARKER_END);
    await keyEdit("deleteRight");
    assert.strictEqual(line0(), "## fixture line one", "forward, from a before-stop");
    await keyEdit("undo");
    assert.strictEqual(line0(), LINE_0, "one undo step");
  });

  test("delete from an after-stop takes it backwards", async () => {
    await put(await openFixture("fixture-after.md"), 0, MARKER_START);
    await keyEdit("deleteLeft");
    assert.strictEqual(line0(), "## fixture line one");
  });

  test("the key pointing away from the range takes an ordinary character", async () => {
    await put(await openFixture("fixture.md"), 0, MARKER_END);
    await keyEdit("deleteLeft");
    assert.strictEqual(line0(), "##{!A3BF9Z} fixture line one", "the space in front of it");
  });

  test("typed text lands on the side the caret stop declares", async () => {
    await put(await openFixture("fixture.md"), 0, MARKER_END);
    await keyEdit("type", { text: "1. " });
    assert.strictEqual(line0(), "## 1. {!A3BF9Z} fixture line one");
  });

  test("typed text at an after-stop lands behind the whole hidden run", async () => {
    await put(await openFixture("fixture-after.md"), 0, MARKER_START);
    await keyEdit("type", { text: "X" });
    // The rule hides `{!A3BF9Z} ` — the trailing space included — so "behind it" is up against
    // the word that follows, not in the gap the marker left. Which characters a rule takes is
    // therefore part of the caret-stop decision, not a detail of the pattern.
    assert.strictEqual(line0(), "## {!A3BF9Z} Xfixture line one");
  });

  test("a selection reaching a hidden range takes all of it", async () => {
    const editor = await openFixture("fixture.md");
    await put(editor, 0, 0);
    for (let step = 0; step < 4; step += 1) {
      await press("cursorRightSelect");
    }
    const selection = live().selection;
    assert.strictEqual(selection.start.character, 0);
    assert.ok(
      selection.end.character <= MARKER_START || selection.end.character >= MARKER_END,
      `selection ended at ${selection.end.character}, inside the hidden range`,
    );
  });

  test("copy carries the file's text, never what is drawn", async () => {
    await put(await openFixture("fixture.md"), 1, 0);
    await press("cursorEndSelect");
    await vscode.commands.executeCommand("editor.action.clipboardCopyAction");
    assert.strictEqual(await vscode.env.clipboard.readText(), "plain #done tail");
  });

  test("reveal drops the concealment while the caret rests against the range", async () => {
    const editor = await openFixture("fixture.md");
    const uri = editor.document.uri.toString();
    await put(editor, 2, 0);
    api.refresh();
    assert.strictEqual(api.stats().documents.find((entry) => entry.uri === uri)?.revealed, 0);

    await put(editor, 2, 7);
    api.refresh();
    assert.strictEqual(api.stats().documents.find((entry) => entry.uri === uri)?.revealed, 1);
  });

  test("the file is never touched by any of this", async () => {
    const editor = await openFixture("fixture.md");
    assert.strictEqual(editor.document.isDirty, false);
    assert.strictEqual(line0(), LINE_0);
  });
});
