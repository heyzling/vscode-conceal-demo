import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";
import { pairs } from "../../cases/04-markup/markup";

/** Case 4, markdown emphasis: the parse is a pure function of the document, asserted directly. */
suite("markup", () => {
  async function open(relativePath: string): Promise<vscode.TextDocument> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, "the examples folder must be the workspace");
    return vscode.workspace.openTextDocument(vscode.Uri.file(path.join(folder.uri.fsPath, relativePath)));
  }

  test("finds each pair as its two markers and the text between them", async () => {
    const document = await open("04-markup/emphasis.md");
    const found = pairs(document).map((pair) => [
      pair.kind,
      document.getText(pair.opener),
      document.getText(pair.text),
      document.getText(pair.closer),
    ]);
    assert.deepStrictEqual(found, [
      ["bold", "**", "bold", "**"],
      ["italic", "_", "italic", "_"],
      ["bold", "**", "bold", "**"],
      ["code", "`", "code", "`"],
    ]);
  });

  test("a marker without a partner is not a pair", async () => {
    const document = await vscode.workspace.openTextDocument({
      language: "markdown",
      content: "*bold** and snake_case_name and `tick",
    });
    assert.deepStrictEqual(pairs(document), []);
  });
});
