/**
 * Long attribute values folded. Every `class="…"` value longer than the threshold is concealed
 * and a `•••` chip drawn in its place. A fold opens while the caret touches it and closes when
 * the caret leaves; whether any key that reaches a fold opens it, or a mouse click only, is the
 * `conceal-demo.foldReveal` setting.
 *
 * Conceal options used: `replacement`.
 */

import * as vscode from "vscode";

/** Values this long or shorter are left as they are. */
const FOLD_THRESHOLD = 30;

/** The fold itself: a bold `•••` chip in place of the value. */
const foldDecoration = vscode.window.createTextEditorDecorationType({
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  conceal: {
    replacement: {
      contentText: "•••",
      fontWeight: "bold",
      color: new vscode.ThemeColor("editor.foreground"),
      backgroundColor: new vscode.ThemeColor("editorInlayHint.background"),
      borderRadius: "3px",
      padding: "0 3px",
    },
  },
});

const CLASS_VALUE = /class="([^"]*)"/g;
const VALUE_OFFSET = 'class="'.length;

type Reveal = "adjacent" | "click";

/** The values worth folding, quotes excluded. A value spread over several lines is left alone. */
function findFolds(document: vscode.TextDocument): vscode.Range[] {
  const folds: vscode.Range[] = [];
  const text = document.getText();
  CLASS_VALUE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CLASS_VALUE.exec(text)) !== null) {
    const start = document.positionAt(match.index + VALUE_OFFSET);
    const end = document.positionAt(match.index + VALUE_OFFSET + match[1].length);
    const value = new vscode.Range(start, end);
    if (!value.isSingleLine || match[1].length <= FOLD_THRESHOLD) {
      continue;
    }
    folds.push(value);
  }
  return folds;
}

/** Folds standing open, per document, keyed by where the value starts. */
const openFolds = new Map<string, Set<string>>();

function refresh(editor: vscode.TextEditor, kind?: vscode.TextEditorSelectionChangeKind): void {
  // This case's own example file only
  if (!editor.document.uri.path.includes("/07-fold/")) {
    return;
  }
  const reveal = vscode.workspace.getConfiguration("conceal-demo").get<Reveal>("foldReveal", "adjacent");
  const documentKey = editor.document.uri.toString();
  const wasOpen = openFolds.get(documentKey) ?? new Set<string>();
  const open = new Set<string>();
  const concealed: vscode.Range[] = [];
  for (const value of findFolds(editor.document)) {
    const id = `${value.start.line}:${value.start.character}`;
    const touched = editor.selections.some((selection) => selection.intersection(value) !== undefined);
    // A caret on the fold keeps it open; what opens it is any arrival, or a mouse click only.
    const opens = reveal === "adjacent" || wasOpen.has(id) || kind === vscode.TextEditorSelectionChangeKind.Mouse;
    if (touched && opens) {
      open.add(id);
      continue;
    }
    concealed.push(value);
  }
  openFolds.set(documentKey, open);
  editor.setDecorations(foldDecoration, concealed);
}

function refreshAll(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    refresh(editor);
  }
}

/** Flips `conceal-demo.foldReveal` between `adjacent` and `click`. */
async function toggleRevealOnClick(): Promise<void> {
  const configuration = vscode.workspace.getConfiguration("conceal-demo");
  const next: Reveal = configuration.get<Reveal>("foldReveal", "adjacent") === "click" ? "adjacent" : "click";
  await configuration.update("foldReveal", next, vscode.ConfigurationTarget.Global);
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    foldDecoration,
    vscode.commands.registerCommand("conceal-demo.toggleFoldRevealOnClick", toggleRevealOnClick),
    vscode.window.onDidChangeVisibleTextEditors(refreshAll),
    vscode.window.onDidChangeTextEditorSelection((event) => refresh(event.textEditor, event.kind)),
    vscode.workspace.onDidChangeTextDocument(refreshAll),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("conceal-demo.foldReveal")) {
        refreshAll();
      }
    }),
  );
  refreshAll();
}
