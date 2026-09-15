/**
 * Long attribute values folded to a `•••` chip. A click on the chip unfolds the value, which then
 * starts with a chip of its own; a click on that folds it again. The chip predicts nothing about
 * the value, so a delete key beside it shows the value and takes nothing; the caret leaving folds
 * it again.
 *
 * Concealment draws over text only, so the chip of an unfolded value is a plain `before`
 * attachment. A click on either chip is only ever seen as the caret landing at the value's edge.
 */

import * as vscode from "vscode";
import { decorations, type Example } from "./example";

// A `class` value longer than 30 characters, quotes excluded.
const VALUE = /(?<=class=")[^"]{31,}(?=")/g;
const FILE = "card.html";

const CHIP: vscode.ThemableDecorationAttachmentRenderOptions = {
  contentText: "•••",
  fontWeight: "bold",
  color: new vscode.ThemeColor("editor.foreground"),
  backgroundColor: new vscode.ThemeColor("editorInlayHint.background"),
  textDecoration: "none; border-radius: 3px; padding: 0 3px",
};

const fold = vscode.window.createTextEditorDecorationType({ conceal: { deletionPolicy: vscode.ConcealDeletionPolicy.Reveal, replacement: CHIP } });
const unfolded = vscode.window.createTextEditorDecorationType({ before: CHIP });

/** Folds standing open, as `uri#line:column` of where the value starts. */
const open = new Set<string>();

function key(document: vscode.TextDocument, range: vscode.Range): string {
  return `${document.uri}#${range.start.line}:${range.start.character}`;
}

export const examples: Example[] = [
  { file: FILE, pattern: VALUE, decoration: fold, skip: (document, range) => open.has(key(document, range)) },
  { file: FILE, pattern: VALUE, decoration: unfolded, skip: (document, range) => !open.has(key(document, range)) },
];

/** Unfolds the value the caret touches, or folds it again from the chip at its start. */
function toggle(editor: vscode.TextEditor): void {
  const position = editor.selection.active;
  const line = editor.document.lineAt(position.line).text;
  VALUE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = VALUE.exec(line)) !== null) {
    const range = new vscode.Range(position.line, match.index, position.line, match.index + match[0].length);
    const id = key(editor.document, range);
    if (open.has(id) ? !position.isEqual(range.start) : !range.contains(position)) {
      continue;
    }
    // The caret moves off the spot clicked: a click there again would not be a selection change.
    let caret: vscode.Position;
    if (open.delete(id)) {
      caret = range.end.translate(0, 1);
    } else {
      open.add(id);
      caret = range.end;
    }
    editor.selection = new vscode.Selection(caret, caret);
    for (const example of examples) {
      editor.setDecorations(example.decoration, decorations(editor.document, example));
    }
    return;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      const [selection] = event.selections;
      if (
        event.kind === vscode.TextEditorSelectionChangeKind.Mouse &&
        event.selections.length === 1 &&
        selection.isEmpty &&
        event.textEditor.document.uri.path.endsWith(`/05-gallery/${FILE}`)
      ) {
        toggle(event.textEditor);
      }
    }),
  );
}
