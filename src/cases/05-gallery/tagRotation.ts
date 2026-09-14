/**
 * `#todo` drawn as ⬜ and `#done` as ✅. A click on the glyph rewrites the tag to the other one,
 * as does `Conceal Demo: Rotate Tag` at the caret. The rewrite is the extension's edit: the
 * editor only puts the caret at the glyph's edge, which is all a click on drawn text can do.
 */

import * as vscode from "vscode";
import type { Example } from "./example";

const GLYPH: Record<string, string> = { "#todo": "⬜", "#done": "✅" };
const NEXT: Record<string, string> = { "#todo": "#done", "#done": "#todo" };
const TAG = /#(?:todo|done)\b/g;
const FILE = "todo.md";

// The rewrite is this file's own edit and leaves a tag behind, so it does not reveal the range.
const tag = vscode.window.createTextEditorDecorationType({ conceal: { revealOnEdit: false } });

export const examples: Example[] = [
  { file: FILE, pattern: TAG, decoration: tag, replacement: (match) => GLYPH[match[0]] },
];

/** Rewrites the tag the caret touches, if any. */
async function rotate(editor: vscode.TextEditor): Promise<void> {
  const position = editor.selection.active;
  const line = editor.document.lineAt(position.line).text;
  TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG.exec(line)) !== null) {
    const found = match[0];
    const range = new vscode.Range(position.line, match.index, position.line, match.index + found.length);
    if (range.contains(position)) {
      await editor.edit((edit) => edit.replace(range, NEXT[found]));
      return;
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("conceal-demo.rotateTag", () => {
      const editor = vscode.window.activeTextEditor;
      return editor && rotate(editor);
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      const [selection] = event.selections;
      if (
        event.kind === vscode.TextEditorSelectionChangeKind.Mouse &&
        event.selections.length === 1 &&
        selection.isEmpty &&
        event.textEditor.document.uri.path.endsWith(`/05-gallery/${FILE}`)
      ) {
        void rotate(event.textEditor);
      }
    }),
  );
}
