import * as vscode from "vscode";

/** Whether concealment is real here. Two steps, because one cannot tell the two failures apart: a
 * build without the feature has no default for the setting, and a build with it throws for an
 * extension that was not granted it. */
export function concealAvailable(): boolean {
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
