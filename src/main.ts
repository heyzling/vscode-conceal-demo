/**
 * Entry point. Each case under `cases/` owns its regular expressions, decoration types and
 * listeners; this file only turns them on.
 */

import * as vscode from "vscode";
import * as tags from "./cases/01-tags/tags";
import * as mask from "./cases/04-mask/mask";
import * as fold from "./cases/07-fold/fold";
import * as recorder from "./recorder";
import * as toggle from "./toggle";

export function activate(context: vscode.ExtensionContext): void {
  toggle.activate(context);
  tags.activate(context);
  mask.activate(context);
  fold.activate(context);
  // Dev tooling: plays the scenes behind the README's GIFs, and does nothing otherwise.
  recorder.activate();
}

export function deactivate(): void {
  // Every case registers what it creates in context.subscriptions.
}
