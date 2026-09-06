/**
 * Long attribute values folded. Every `class="…"` value longer than the threshold is concealed
 * and a `•••` chip drawn in its place. A value that runs over several lines folds to one row: the lines
 * below its first are left out of the view, and its closing quote is drawn after the `•••` as a
 * second replacement, in the string's own colour. A fold opens while the caret touches it and closes when the
 * caret leaves; whether any key that reaches a fold opens it, or a mouse click only, is the
 * `conceal-demo.foldReveal` setting.
 *
 * Conceal options used: `replacement`, per range for the closing quote, and `line`.
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

/** The lines a folded value continues on. */
const hiddenLineDecoration = vscode.window.createTextEditorDecorationType({
  conceal: { line: true },
});

/** What follows a multi-line value on its last line, drawn on the folded row as itself. */
const closingDecoration = vscode.window.createTextEditorDecorationType({
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  conceal: { replacement: { contentText: '"' } },
});

const CLASS_VALUE = /class="([^"]*)"/g;
const VALUE_OFFSET = 'class="'.length;

type Reveal = "adjacent" | "click";

interface Fold {
  /** The value, quotes excluded. */
  value: vscode.Range;
  /** Where a caret counts as touching the fold: the value, run to the end of its last hidden line. */
  reach: vscode.Range;
  /** Concealed: the value's part on its first line, drawn as `•••`. */
  concealed: vscode.Range;
  /** A multi-line value's closing quote and what follows it, drawn after the `•••`. */
  closing?: { range: vscode.Range; text: string };
  /** Lines the value continues on, left out of the view. */
  hiddenLines: number[];
}

function findFolds(document: vscode.TextDocument): Fold[] {
  const folds: Fold[] = [];
  const text = document.getText();
  CLASS_VALUE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CLASS_VALUE.exec(text)) !== null) {
    const start = document.positionAt(match.index + VALUE_OFFSET);
    const end = document.positionAt(match.index + VALUE_OFFSET + match[1].length);
    const value = new vscode.Range(start, end);
    if (value.isSingleLine && match[1].length <= FOLD_THRESHOLD) {
      continue;
    }
    const lastLine = document.lineAt(end.line);
    const firstLineEnd = document.lineAt(start.line).range.end;
    // The closing quote lives on a hidden line, so the first line's last character stands in for it.
    const closingStart = value.isSingleLine ? firstLineEnd : firstLineEnd.translate(0, -1);
    const hiddenLines: number[] = [];
    for (let line = start.line + 1; line <= end.line; line += 1) {
      hiddenLines.push(line);
    }
    folds.push({
      value,
      reach: value.isSingleLine ? value : new vscode.Range(start, lastLine.range.end),
      concealed: value.isSingleLine ? value : new vscode.Range(start, closingStart),
      closing: value.isSingleLine
        ? undefined
        : { range: new vscode.Range(closingStart, firstLineEnd), text: lastLine.text.slice(end.character) },
      hiddenLines,
    });
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
  const closings: vscode.DecorationOptions[] = [];
  const hidden: vscode.Range[] = [];
  for (const fold of findFolds(editor.document)) {
    const id = `${fold.value.start.line}:${fold.value.start.character}`;
    const touched = editor.selections.some((selection) => selection.intersection(fold.reach) !== undefined);
    // A caret on the fold keeps it open; what opens it is any arrival, or a mouse click only.
    const opens = reveal === "adjacent" || wasOpen.has(id) || kind === vscode.TextEditorSelectionChangeKind.Mouse;
    if (touched && opens) {
      open.add(id);
      continue;
    }
    concealed.push(fold.concealed);
    if (fold.closing) {
      closings.push({
        range: fold.closing.range,
        renderOptions: { conceal: { replacement: { contentText: fold.closing.text } } },
      });
    }
    hidden.push(...fold.hiddenLines.map((line) => new vscode.Range(line, 0, line, 0)));
  }
  openFolds.set(documentKey, open);
  editor.setDecorations(foldDecoration, concealed);
  editor.setDecorations(closingDecoration, closings);
  editor.setDecorations(hiddenLineDecoration, hidden);
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
    closingDecoration,
    hiddenLineDecoration,
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
