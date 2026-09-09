/**
 * Strings drawn from a source outside the file: a translation key drawn as its translation, a
 * comment drawn in another language. What is drawn cannot be rebuilt from the text that matched,
 * so every range brings its own replacement and one decoration type serves all of them. Editing
 * the catalogue redraws the source.
 *
 * Conceal options used: per-range `replacement`, `deletionPolicy: "reveal"`.
 */

import * as fs from "node:fs";
import * as vscode from "vscode";

/** One type for every string drawn — only the replacement varies, and it travels with the range. */
const translationDecoration = vscode.window.createTextEditorDecorationType({
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  // The drawn string predicts nothing about the text, so a delete key shows it before it takes.
  conceal: { deletionPolicy: "reveal" },
});

/** Each example file, the catalogue its strings come from, and what is looked up in it. */
const SOURCES = [
  // A `t("key")` call drawn as the string the catalogue holds for that key.
  { file: "checkout.ts", catalogue: "messages.en.json", pattern: /\bt\("([\w.]+)"\)/g },
  // A comment drawn in English, keyed by the Spanish it is written in; its markers stay visible.
  { file: "comments.ts", catalogue: "comments.en.json", pattern: /(?<=\/\/ |\/\*\* )(.+?)(?= \*\*\/$|$)/g },
];

/** The catalogue beside `document`. An open buffer is read before disk, so an unsaved edit counts;
 * one that does not parse answers nothing and every string comes back as text. */
function catalogueFor(document: vscode.TextDocument, name: string): Record<string, string> {
  const uri = vscode.Uri.joinPath(document.uri, "..", name);
  const open = vscode.workspace.textDocuments.find((candidate) => candidate.uri.fsPath === uri.fsPath);
  try {
    return JSON.parse(open ? open.getText() : fs.readFileSync(uri.fsPath, "utf8"));
  } catch {
    return {};
  }
}

/** What is drawn over `document`: one range per match the catalogue answers, the rest left as text. */
export function substitution(document: vscode.TextDocument): vscode.DecorationOptions[] {
  const source = SOURCES.find((candidate) => document.uri.path.endsWith(`/${candidate.file}`));
  if (!source) {
    return [];
  }
  const catalogue = catalogueFor(document, source.catalogue);
  const decorations: vscode.DecorationOptions[] = [];
  for (let line = 0; line < document.lineCount; line += 1) {
    const text = document.lineAt(line).text;
    source.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = source.pattern.exec(text)) !== null) {
      const translation = catalogue[match[1]];
      if (typeof translation !== "string") {
        continue;
      }
      decorations.push({
        range: new vscode.Range(line, match.index, line, match.index + match[0].length),
        renderOptions: { conceal: { replacement: { contentText: translation } } },
        // The projection is lossy, so what was written stays reachable.
        hoverMessage: `\`${match[1]}\``,
      });
    }
  }
  return decorations;
}

function refresh(editor: vscode.TextEditor): void {
  // This case's own example files only
  if (!editor.document.uri.path.includes("/02-i18n/")) {
    return;
  }
  editor.setDecorations(translationDecoration, substitution(editor.document));
}

function refreshAll(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    refresh(editor);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  // The catalogues stand in for an external system: they change with no edit to the source file.
  const catalogueWatcher = vscode.workspace.createFileSystemWatcher("**/02-i18n/*.json");
  context.subscriptions.push(
    translationDecoration,
    catalogueWatcher,
    catalogueWatcher.onDidChange(refreshAll),
    catalogueWatcher.onDidCreate(refreshAll),
    catalogueWatcher.onDidDelete(refreshAll),
    vscode.window.onDidChangeVisibleTextEditors(refreshAll),
    // Covers an unsaved edit to a catalogue as well as one to the source.
    vscode.workspace.onDidChangeTextDocument(refreshAll),
  );
  refreshAll();
}
