/**
 * `"name":` reads as `name:`. The quotes are mandatory grammar, so no delete key reaches them,
 * and each belongs to the key — the opening one to the text behind it, the closing one to the
 * text in front — so typing at either visible edge of a key stays inside its quotes.
 */

import * as vscode from "vscode";
import type { Example } from "./example";

const openingQuote = vscode.window.createTextEditorDecorationType({
  conceal: { anchor: vscode.ConcealAnchor.After, deletionPolicy: vscode.ConcealDeletionPolicy.Protect },
});

const closingQuote = vscode.window.createTextEditorDecorationType({
  conceal: { anchor: vscode.ConcealAnchor.Before, deletionPolicy: vscode.ConcealDeletionPolicy.Protect },
});

export const examples: Example[] = [
  { file: "config.json", pattern: /"(?=[^"]+":)/g, decoration: openingQuote },
  { file: "config.json", pattern: /(?<="[^"]+)"(?=:)/g, decoration: closingQuote },
];
