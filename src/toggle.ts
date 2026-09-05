/**
 * `Conceal Demo: Toggle Concealment` — flips `editor.conceal.enabled`, the editor's own switch, so
 * no case is re-run.
 */

import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("conceal-demo.toggle", async () => {
      const editor = vscode.workspace.getConfiguration("editor");
      const on = editor.get<boolean>("conceal.enabled") !== false;
      await editor.update("conceal.enabled", !on, vscode.ConfigurationTarget.Global);
    }),
  );
}
