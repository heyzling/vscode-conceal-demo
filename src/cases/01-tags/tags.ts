/**
 * Tags in a to-do list: `#todo` and `#idea` decorated the way an extension decorates them today,
 * `#done` and `#bug` concealed with a glyph drawn in their place.
 *
 * Conceal options used: `replacement`.
 */

import * as vscode from "vscode";

/** `#todo` — an ordinary decoration: the text stays and a colour is painted over it. */
const todoDecoration = vscode.window.createTextEditorDecorationType({
  color: new vscode.ThemeColor("charts.blue"),
  backgroundColor: new vscode.ThemeColor("editorInlayHint.background"),
  borderRadius: "3px",
});

/** `#idea` — an ordinary decoration, foreground only. */
const ideaDecoration = vscode.window.createTextEditorDecorationType({
  color: new vscode.ThemeColor("charts.purple"),
  fontWeight: "bold",
});

/** `#done` — concealed, with a glyph drawn in its place. The glyph belongs to the decoration type,
 * so a second glyph needs a second type. */
const doneDecoration = vscode.window.createTextEditorDecorationType({
  // A concealed range must not grow over a character typed against its edge.
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  conceal: {
    replacement: {
      contentText: "✅",
    },
  },
});

/** `#bug` — concealed, and drawn as a chip rather than a bare glyph. */
const bugDecoration = vscode.window.createTextEditorDecorationType({
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  conceal: {
    replacement: {
      contentText: "🐞 bug",
      color: new vscode.ThemeColor("charts.red"),
      backgroundColor: new vscode.ThemeColor("editorInlayHint.background"),
      borderRadius: "3px",
    },
  },
});

const TODO = /#todo\b/g;
const IDEA = /#idea\b/g;
const DONE = /#done\b/g;
const BUG = /#bug\b/g;

function refresh(editor: vscode.TextEditor): void {
  // This case's own example file only
  if (!editor.document.uri.path.includes("/01-tags/")) {
    return;
  }
  editor.setDecorations(todoDecoration, findRanges(editor.document, TODO));
  editor.setDecorations(ideaDecoration, findRanges(editor.document, IDEA));
  editor.setDecorations(doneDecoration, findRanges(editor.document, DONE));
  editor.setDecorations(bugDecoration, findRanges(editor.document, BUG));
}

/** Every match of `pattern`, line by line. Only a range within one line is concealed. */
function findRanges(
  document: vscode.TextDocument,
  pattern: RegExp,
): vscode.Range[] {
  const ranges: vscode.Range[] = [];
  for (let line = 0; line < document.lineCount; line += 1) {
    const text = document.lineAt(line).text;
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      ranges.push(
        new vscode.Range(
          line,
          match.index,
          line,
          match.index + match[0].length,
        ),
      );
    }
  }
  return ranges;
}

function refreshAll(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    refresh(editor);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    todoDecoration,
    ideaDecoration,
    doneDecoration,
    bugDecoration,
    vscode.window.onDidChangeVisibleTextEditors(refreshAll),
    // An edit inside a concealed range reveals it until the decoration is applied again.
    vscode.workspace.onDidChangeTextDocument(refreshAll),
  );
  refreshAll();
}
