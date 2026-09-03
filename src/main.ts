/**
 * Entry point. Every case lives under `cases/` and owns everything it needs — its regular
 * expressions, its decoration types, its listeners — so that one folder can be read on its own and
 * show the whole shape of the conceal API it uses. This file only turns them on.
 */

import * as vscode from "vscode";

export function activate(_context: vscode.ExtensionContext): void {
  // Cases are activated here, one line each.
}

export function deactivate(): void {
  // Every case registers what it creates in context.subscriptions.
}
