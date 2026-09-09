import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";
import { substitution } from "../../cases/02-i18n/i18n";

/**
 * Case 2, the dynamic replacement: what is drawn comes from a file outside the source, and an edit
 * to that file changes it with the source untouched.
 *
 * The projection is asserted directly — it is a pure function of the document and the catalogue.
 * The last test measures what the *editor* did with it and is skipped where there is no conceal
 * API, because there is then nothing to measure.
 */
const SOURCE = "02-i18n/checkout.ts";
const COMMENTS = "02-i18n/comments.ts";
const CATALOGUE = "02-i18n/messages.en.json";

/** Two steps, because one cannot tell the two failures apart: a build without the feature has no
 * default for the setting, and a build with it throws for an extension that was not granted it. */
function concealAvailable(): boolean {
  if (vscode.workspace.getConfiguration().inspect<boolean>("editor.conceal.enabled")?.defaultValue === undefined) {
    return false;
  }
  let probe: vscode.TextEditorDecorationType | undefined;
  try {
    probe = vscode.window.createTextEditorDecorationType({ conceal: {} });
    return true;
  } catch {
    return false;
  } finally {
    probe?.dispose();
  }
}

suite("i18n", () => {
  let catalogue: vscode.TextDocument;
  let pristine: string;

  function uriFor(relativePath: string): vscode.Uri {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, "the examples folder must be the workspace");
    return vscode.Uri.file(path.join(folder.uri.fsPath, relativePath));
  }

  async function open(relativePath: string): Promise<vscode.TextEditor> {
    const document = await vscode.workspace.openTextDocument(uriFor(relativePath));
    return vscode.window.showTextDocument(document);
  }

  /** Rewrites the catalogue in its buffer, never on disk: an unsaved edit is what the demo shows. */
  async function writeCatalogue(text: string): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    const end = catalogue.lineAt(catalogue.lineCount - 1).range.end;
    edit.replace(catalogue.uri, new vscode.Range(new vscode.Position(0, 0), end), text);
    assert.ok(await vscode.workspace.applyEdit(edit));
  }

  function drawn(document: vscode.TextDocument): string[] {
    return substitution(document).map((decoration) => decoration.renderOptions?.conceal?.replacement?.contentText ?? "");
  }

  suiteSetup(async () => {
    catalogue = await vscode.workspace.openTextDocument(uriFor(CATALOGUE));
    pristine = catalogue.getText();
  });

  suiteTeardown(async () => {
    await writeCatalogue(pristine);
  });

  test("draws what the catalogue holds, not what the text says", async () => {
    const editor = await open(SOURCE);
    assert.deepStrictEqual(drawn(editor.document), [
      "Welcome back",
      "Your cart is empty",
      "Go to checkout",
      "Thanks — your order is on its way",
    ]);
  });

  test("a key the catalogue does not answer is left as text", async () => {
    const editor = await open(SOURCE);
    const text = editor.document.getText();
    assert.ok(text.includes('t("cart.shipping")'), "the fixture must carry an unanswered key");
    for (const decoration of substitution(editor.document)) {
      assert.ok(!editor.document.getText(decoration.range).includes("cart.shipping"));
    }
  });

  test("editing the catalogue redraws the source, which is not touched", async () => {
    const editor = await open(SOURCE);
    const before = editor.document.getText();
    await writeCatalogue(pristine.replace("Your cart is empty", "Nothing in here yet"));
    assert.ok(drawn(editor.document).includes("Nothing in here yet"));
    assert.strictEqual(editor.document.getText(), before);
  });

  test("a key gained by the catalogue starts being drawn", async () => {
    const editor = await open(SOURCE);
    await writeCatalogue(pristine.replace('"cart.empty"', '"cart.shipping": "Ships in two days",\n  "cart.empty"'));
    assert.ok(drawn(editor.document).includes("Ships in two days"));
    assert.strictEqual(substitution(editor.document).length, 5);
  });

  test("draws a comment in the language the catalogue answers with", async () => {
    const editor = await open(COMMENTS);
    assert.deepStrictEqual(drawn(editor.document), [
      "Prices in cents, always integers",
      "Add up the cart and apply the discount",
      "Round to the nearest cent",
      "The discount applies to the total, never to a single line: rounding would change the result",
    ]);
  });

  test("the comment marker is left visible, only what follows it is drawn over", async () => {
    const editor = await open(COMMENTS);
    for (const decoration of substitution(editor.document)) {
      assert.ok(!editor.document.getText(decoration.range).startsWith("//"));
    }
  });

  test("a comment the catalogue does not answer is left in its own language", async () => {
    const editor = await open(COMMENTS);
    const untranslated = "Sin traducción todavía";
    assert.ok(editor.document.getText().includes(untranslated), "the fixture must carry one");
    for (const decoration of substitution(editor.document)) {
      assert.ok(!editor.document.getText(decoration.range).includes(untranslated));
    }
  });

  test("a delete key shows the call and takes nothing; the next press edits it", async function () {
    if (!concealAvailable()) {
      this.skip();
    }
    await writeCatalogue(pristine);
    const editor = await open(SOURCE);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const call = substitution(editor.document)[0];
    const before = editor.document.getText();
    editor.selection = new vscode.Selection(call.range.end, call.range.end);
    await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    await vscode.commands.executeCommand("deleteLeft");
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.strictEqual(editor.document.getText(), before, "the first press deletes nothing");
    await vscode.commands.executeCommand("deleteLeft");
    await new Promise((resolve) => setTimeout(resolve, 200));
    const line = editor.document.lineAt(call.range.start.line).text;
    assert.ok(line.includes('t("account.greeting"') && !line.includes('t("account.greeting")'), "the second takes the character it showed");
    await vscode.commands.executeCommand("undo");
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.strictEqual(editor.document.getText(), before, "undo restores it");
    // The call stays open while the caret is at it; leave, so it closes for the next test.
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  test("one press of the caret crosses a call drawn as its translation", async function () {
    if (!concealAvailable()) {
      this.skip();
    }
    await writeCatalogue(pristine);
    const editor = await open(SOURCE);
    // The extension decorates on its own events; give it the turn it needs before measuring.
    await new Promise((resolve) => setTimeout(resolve, 500));
    const call = substitution(editor.document)[0];
    editor.selection = new vscode.Selection(call.range.start, call.range.start);
    await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    await vscode.commands.executeCommand("cursorRight");
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.deepStrictEqual(
      { line: editor.selection.active.line, character: editor.selection.active.character },
      { line: call.range.end.line, character: call.range.end.character },
    );
  });
});
