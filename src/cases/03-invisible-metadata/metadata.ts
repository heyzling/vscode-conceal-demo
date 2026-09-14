/**
 * Machine data written into a file by something other than the person reading it: the block id
 * Obsidian appends when you copy a link to a block. Nothing is drawn in its place, so the range
 * collapses to one place the caret crosses in a single press, and a delete steps over it.
 *
 * Conceal options used: `anchor`, `deletionPolicy`, with no `replacement`.
 */

import * as vscode from "vscode";

/** An id nobody types by hand, leaning to the end of its line: text typed at the line end goes
 * in front of it, Enter there leaves it on its line, and a delete steps over it. */
const idDecoration = vscode.window.createTextEditorDecorationType({
  conceal: {
    anchor: "lineEnd",
    deletionPolicy: "protect",
  },
});

/** A block reference inside a link is not line metadata: no anchor, only protection. */
const refDecoration = vscode.window.createTextEditorDecorationType({
  conceal: {
    deletionPolicy: "protect",
  },
});

/** A block id closing a block, with the space. */
const BLOCK_ID = / \^[A-Za-z0-9-]+$/g;

/** The block a wikilink points at: `[[Note#^id]]` is left reading as `[[Note]]`. */
const BLOCK_REF = /#\^[A-Za-z0-9-]+(?=\]\])/g;

/** Every match of `pattern`, line by line. Only a range within one line is concealed. */
function findRanges(document: vscode.TextDocument, pattern: RegExp): vscode.Range[] {
  const ranges: vscode.Range[] = [];
  for (let line = 0; line < document.lineCount; line += 1) {
    const text = document.lineAt(line).text;
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      ranges.push(new vscode.Range(line, match.index, line, match.index + match[0].length));
    }
  }
  return ranges;
}

function refresh(editor: vscode.TextEditor): void {
  // This case's own example files only
  if (!editor.document.uri.path.includes("/03-invisible-metadata/")) {
    return;
  }
  const document = editor.document;
  editor.setDecorations(idDecoration, findRanges(document, BLOCK_ID));
  editor.setDecorations(refDecoration, findRanges(document, BLOCK_REF));
}

function refreshAll(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    refresh(editor);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    idDecoration,
    refDecoration,
    vscode.window.onDidChangeVisibleTextEditors(refreshAll),
    vscode.workspace.onDidChangeTextDocument(refreshAll),
  );
  refreshAll();
}
