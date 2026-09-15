/**
 * Small examples, one file each: a regular expression, a decoration type, an example file, and
 * nothing more. This file applies them.
 */

import * as vscode from "vscode";
import { decorations, type Example } from "./example";
import * as fold from "./fold";
import * as fsharpLambda from "./fsharpLambda";
import * as jsonKeys from "./jsonKeys";
import * as latexMacros from "./latexMacros";
import * as tagRotation from "./tagRotation";
import * as tsArrow from "./tsArrow";

const EXAMPLES: Example[] = [
  ...jsonKeys.examples,
  ...fsharpLambda.examples,
  ...tsArrow.examples,
  ...latexMacros.examples,
  ...tagRotation.examples,
  ...fold.examples,
];

function refresh(editor: vscode.TextEditor): void {
  // This case's own example files only
  const path = editor.document.uri.path;
  if (!path.includes("/05-gallery/")) {
    return;
  }
  for (const example of EXAMPLES) {
    editor.setDecorations(example.decoration, path.endsWith(`/${example.file}`) ? decorations(editor.document, example) : []);
  }
}

function refreshAll(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    refresh(editor);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    ...EXAMPLES.map((example) => example.decoration),
    vscode.window.onDidChangeVisibleTextEditors(refreshAll),
    vscode.workspace.onDidChangeTextDocument(refreshAll),
  );
  tagRotation.activate(context);
  fold.activate(context);
  refreshAll();
}
