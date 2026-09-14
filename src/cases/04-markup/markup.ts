/**
 * Markdown emphasis: `**bold**`, `_italic_` and `` `code` `` read as the styled word alone.
 * Nothing is drawn in a marker's place, and each marker belongs to the text it wraps — the opening
 * one to the word behind it, the closing one to the word in front — so typing at either visible
 * edge of the word stays inside the pair, Enter or a space typed there lands outside it, and no
 * delete key reaches a marker.
 *
 * Conceal options used: `anchor: "after"` and `anchor: "before"`, `deletionPolicy: "protect"`,
 * with no `replacement`.
 */

import * as vscode from "vscode";

/** An opening marker belongs to the word behind it: the caret stops behind the marker, text typed
 * there is emphasised, and Enter or a space there goes in front of the pair. */
const openingDecoration = vscode.window.createTextEditorDecorationType({
  conceal: { anchor: "after", deletionPolicy: "protect" },
});

/** A closing marker belongs to the word in front of it: the mirror image. */
const closingDecoration = vscode.window.createTextEditorDecorationType({
  conceal: { anchor: "before", deletionPolicy: "protect" },
});

/** The markers carry the styling, so the text between them gets it from an ordinary decoration. */
const KINDS = [
  {
    name: "bold",
    marker: "**",
    pattern: /\*\*([^*]+)\*\*/g,
    decoration: vscode.window.createTextEditorDecorationType({ fontWeight: "bold" }),
  },
  {
    name: "italic",
    marker: "_",
    // A `_` inside a word is not a marker.
    pattern: /(?<![\w_])_([^_]+)_(?![\w_])/g,
    decoration: vscode.window.createTextEditorDecorationType({ fontStyle: "italic" }),
  },
  {
    name: "code",
    marker: "`",
    pattern: /`([^`]+)`/g,
    decoration: vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor("textPreformat.foreground"),
      backgroundColor: new vscode.ThemeColor("textPreformat.background"),
      borderRadius: "3px",
    }),
  },
] as const;

export type Kind = (typeof KINDS)[number]["name"];

/** One emphasised run: its two markers and the text between them. */
export interface Pair {
  kind: Kind;
  opener: vscode.Range;
  text: vscode.Range;
  closer: vscode.Range;
}

/** Every pair in `document`, line by line. Only a range within one line is concealed, and a pair
 * missing its partner is not a pair, so an orphan marker stays in view. */
export function pairs(document: vscode.TextDocument): Pair[] {
  const found: Pair[] = [];
  for (let line = 0; line < document.lineCount; line += 1) {
    const text = document.lineAt(line).text;
    for (const kind of KINDS) {
      kind.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = kind.pattern.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const width = kind.marker.length;
        found.push({
          kind: kind.name,
          opener: new vscode.Range(line, start, line, start + width),
          text: new vscode.Range(line, start + width, line, end - width),
          closer: new vscode.Range(line, end - width, line, end),
        });
      }
    }
  }
  return found;
}

function refresh(editor: vscode.TextEditor): void {
  // This case's own example file only
  if (!editor.document.uri.path.includes("/04-markup/")) {
    return;
  }
  const found = pairs(editor.document);
  editor.setDecorations(openingDecoration, found.map((pair) => pair.opener));
  editor.setDecorations(closingDecoration, found.map((pair) => pair.closer));
  for (const kind of KINDS) {
    editor.setDecorations(kind.decoration, found.filter((pair) => pair.kind === kind.name).map((pair) => pair.text));
  }
}

function refreshAll(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    refresh(editor);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    openingDecoration,
    closingDecoration,
    ...KINDS.map((kind) => kind.decoration),
    vscode.window.onDidChangeVisibleTextEditors(refreshAll),
    vscode.workspace.onDidChangeTextDocument(refreshAll),
  );
  refreshAll();
}
