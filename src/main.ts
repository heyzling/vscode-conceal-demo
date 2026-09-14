/**
 * Entry point. Each case under `cases/` owns its regular expressions, decoration types and
 * listeners; this file only turns them on.
 */

import * as vscode from "vscode";
import * as tags from "./cases/01-tags/tags";
import * as i18n from "./cases/02-i18n/i18n";
import * as metadata from "./cases/03-invisible-metadata/metadata";
import * as markup from "./cases/04-markup/markup";
import * as gallery from "./cases/05-gallery/gallery";
import * as recorder from "./recorder";
import * as toggle from "./toggle";

export function activate(context: vscode.ExtensionContext): void {
  toggle.activate(context);
  tags.activate(context);
  i18n.activate(context);
  metadata.activate(context);
  markup.activate(context);
  gallery.activate(context);
  // Dev tooling: plays the scenes behind the README's GIFs, and does nothing otherwise.
  recorder.activate();
}

export function deactivate(): void {
  // Every case registers what it creates in context.subscriptions.
}
