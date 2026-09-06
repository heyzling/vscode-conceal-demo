/**
 * Secrets in an `.env` file masked. The value of every key named like a secret, and the password
 * inside a connection URL, is concealed and drawn as one `•` per character, so the line keeps its
 * shape. The mask behaves like a password field: a character typed at a secret's edge joins it
 * masked, Backspace takes one hidden character and one dot with it, and the value is shown only
 * when concealment is switched off.
 *
 * Conceal options used: `replacement` per range, `preserveWidth`, `deletionPolicy`, `revealOnEdit`.
 */

import * as vscode from "vscode";

const maskDecoration = vscode.window.createTextEditorDecorationType({
  // A character typed at either edge of a secret joins it, masked as it lands.
  rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
  conceal: {
    // Every range brings its own run of dots; this is the fallback for a value with none.
    replacement: { contentText: "•" },
    preserveWidth: true,
    deletionPolicy: "passthrough",
    revealOnEdit: false,
  },
});

/** A key named like a secret, with the `=` after it. */
const SECRET_KEY = /^\w*(?:SECRET|PASSWORD|KEY|TOKEN)\w*=/;
/** The password of a `scheme://user:password@host` URL. */
const URL_PASSWORD = /:\/\/[^\s:@/]+:([^\s@]+)@/g;

/** Every secret, one range per line. Quotes around a value stay visible. */
function findSecrets(document: vscode.TextDocument): vscode.Range[] {
  const ranges: vscode.Range[] = [];
  for (let line = 0; line < document.lineCount; line += 1) {
    const text = document.lineAt(line).text;
    const key = SECRET_KEY.exec(text);
    if (key) {
      let start = key[0].length;
      let end = text.length;
      if (end - start >= 2 && /^(["']).*\1$/.test(text.slice(start))) {
        start += 1;
        end -= 1;
      }
      if (end > start) {
        ranges.push(new vscode.Range(line, start, line, end));
      }
      continue;
    }
    URL_PASSWORD.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = URL_PASSWORD.exec(text)) !== null) {
      const end = match.index + match[0].length - 1;
      ranges.push(new vscode.Range(line, end - match[1].length, line, end));
    }
  }
  return ranges;
}

function refresh(editor: vscode.TextEditor): void {
  // This case's own example file only
  if (!editor.document.uri.path.includes("/04-mask/")) {
    return;
  }
  const masks = findSecrets(editor.document).map((range) => ({
    range,
    renderOptions: {
      conceal: { replacement: { contentText: "•".repeat(range.end.character - range.start.character) } },
    },
  }));
  editor.setDecorations(maskDecoration, masks);
}

function refreshAll(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    refresh(editor);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    maskDecoration,
    vscode.window.onDidChangeVisibleTextEditors(refreshAll),
    // A secret typed or deleted under its mask changes length: the dots are counted again.
    vscode.workspace.onDidChangeTextDocument(refreshAll),
  );
  refreshAll();
}
