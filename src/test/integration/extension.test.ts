import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";
import { ConcealDemoApi } from "../../extension";
import { MAX_REPLACEMENT_CHARACTERS } from "../../replacement";

const EXTENSION_ID = "heyzling.conceal-demo";

/** The tests run against whichever build `vscode-test` launched. On a stock one they check that
 * nothing is concealed, nothing throws and the reason is reported; on a build carrying the
 * proposal they check that ranges are actually produced. Both are outcomes worth having a test
 * for, and which one applies is read from the extension rather than assumed. */
suite("conceal demo", () => {
  let api: ConcealDemoApi;

  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension<ConcealDemoApi>(EXTENSION_ID);
    assert.ok(extension, `${EXTENSION_ID} is not installed in this host`);
    api = await extension.activate();
  });

  async function open(relativePath: string): Promise<vscode.TextEditor> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, "the examples folder must be the workspace");
    const uri = vscode.Uri.file(path.join(folder.uri.fsPath, relativePath));
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);
    api.refresh();
    return editor;
  }

  function statsFor(editor: vscode.TextEditor) {
    const uri = editor.document.uri.toString();
    const found = api.stats().documents.find((entry) => entry.uri === uri);
    assert.ok(found, `no statistics recorded for ${uri}`);
    return found;
  }

  test("says which of the four states the conceal API is in", () => {
    assert.ok(
      ["available", "no-build-support", "not-granted", "disabled-by-setting"].includes(
        api.availability.kind,
      ),
    );
  });

  test("every shipped rule is runnable", () => {
    const stats = api.stats();
    assert.deepStrictEqual(stats.problems, []);
    assert.ok(stats.exampleRules > 20, `only ${stats.exampleRules} example rules loaded`);
  });

  test("the commands are registered whether or not the API is there", async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const command of ["conceal-demo.toggle", "conceal-demo.showStats", "conceal-demo.showLog"]) {
      assert.ok(commands.includes(command), `${command} is missing`);
    }
  });

  test("showStats answers without throwing", async () => {
    await vscode.commands.executeCommand("conceal-demo.showStats");
  });

  test("a file outside conceal-demo.include is left alone", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: "## {!A3BF9Z} not in the examples folder",
      language: "markdown",
    });
    await vscode.window.showTextDocument(document);
    api.refresh();
    const found = api.stats().documents.find((entry) => entry.uri === document.uri.toString());
    assert.ok(found);
    assert.strictEqual(found.included, false);
    assert.strictEqual(found.spans, 0);
  });

  test("an example file is concealed exactly when the API is available", async () => {
    const editor = await open("03-machine-metadata/notes.md");
    const stats = statsFor(editor);
    assert.strictEqual(stats.included, true);
    if (api.availability.kind === "available") {
      assert.ok(stats.spans >= 4, `expected the identity markers, got ${stats.spans} span(s)`);
      assert.ok(stats.decorationTypes >= 1);
    } else {
      assert.strictEqual(stats.spans, 0, "nothing may be concealed without the API");
      assert.strictEqual(stats.decorationTypes, 0);
    }
  });

  test("the document is never modified", async () => {
    const editor = await open("06-redaction/secrets.env");
    assert.strictEqual(editor.document.isDirty, false);
    assert.ok(editor.document.getText().includes("sk-live-2f9c8a7b6d5e4f3a2b1c0d9e8f7a6b5c"));
  });

  test("per-occurrence replacement costs one decoration type per distinct string", async function () {
    if (api.availability.kind !== "available") {
      this.skip();
    }
    const editor = await open("04-semantic-projection/scenes.md");
    const stats = statsFor(editor);
    assert.ok(
      stats.decorationTypes > stats.rulesApplied.length,
      `${stats.decorationTypes} type(s) for ${stats.rulesApplied.length} rule(s)`,
    );
  });

  test("the editor's replacement cap is reached by a real example", async function () {
    if (api.availability.kind !== "available") {
      this.skip();
    }
    const editor = await open("07-line-elision/fences.md");
    assert.ok(statsFor(editor).truncated > 0, `nothing was cut to ${MAX_REPLACEMENT_CHARACTERS}`);
  });

  test("width preservation runs into the same cap", async function () {
    if (api.availability.kind !== "available") {
      this.skip();
    }
    const editor = await open("06-redaction/secrets.env");
    assert.ok(statsFor(editor).padFailed > 0);
  });
});
