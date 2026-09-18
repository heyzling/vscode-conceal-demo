/**
 * Markdown emphasis: `**bold**`, `_italic_` and `` `code` `` read as the styled word alone.
 * Nothing is drawn in a marker's place, and each marker belongs to the text it wraps — the opening
 * one to the word behind it, the closing one to the word in front — so typing at either visible
 * edge of the word stays inside the pair, Enter typed there lands outside it, and no delete key
 * reaches a marker. A space typed there lands outside the pair too, but that is this extension's
 * doing: the editor places only a line break by a marker's side, and CommonMark stops reading a
 * marker next to a space, so a Space keybinding puts the space where the syntax wants it. Ctrl+B
 * with a selection inside a pair closes the pair in front of the selection.
 *
 * A link is one unit: the whole `[text](url)` is concealed and its text drawn in its place, so a
 * delete key shows the link before it takes anything, and it hides again once the caret leaves.
 *
 * Conceal options used: `anchor: ConcealAnchor.After` and `anchor: ConcealAnchor.Before`,
 * `deletionPolicy: ConcealDeletionPolicy.Protect`, with no `replacement`; for links a per-range
 * `replacement` with `deletionPolicy: ConcealDeletionPolicy.Reveal`.
 */

import * as vscode from "vscode";

/** An opening marker belongs to the word behind it: the caret stops behind the marker, text typed
 * there is emphasised, and Enter there goes in front of the pair. */
const openingDecoration = vscode.window.createTextEditorDecorationType({
  conceal: { anchor: vscode.ConcealAnchor.After, deletionPolicy: vscode.ConcealDeletionPolicy.Protect },
});

/** A closing marker belongs to the word in front of it: the mirror image. */
const closingDecoration = vscode.window.createTextEditorDecorationType({
  conceal: { anchor: vscode.ConcealAnchor.Before, deletionPolicy: vscode.ConcealDeletionPolicy.Protect },
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

/** A link reads as its text, drawn over the whole `[text](url)`. The drawn text predicts nothing
 * about the url, so a delete key shows the link before it takes. */
const linkDecoration = vscode.window.createTextEditorDecorationType({
  conceal: { deletionPolicy: vscode.ConcealDeletionPolicy.Reveal },
});

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

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

/** One link: the whole `[text](url)` and its two parts. */
export interface Link {
  range: vscode.Range;
  text: string;
  url: string;
}

/** Every link in `document`, line by line. */
export function links(document: vscode.TextDocument): Link[] {
  const found: Link[] = [];
  for (let line = 0; line < document.lineCount; line += 1) {
    const text = document.lineAt(line).text;
    LINK.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = LINK.exec(text)) !== null) {
      found.push({
        range: new vscode.Range(line, match.index, line, match.index + match[0].length),
        text: match[1],
        url: match[2],
      });
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
  // Each link draws its own text; the url stays reachable on hover.
  editor.setDecorations(linkDecoration, links(editor.document).map(({ range, text, url }) => ({
    range,
    renderOptions: {
      conceal: {
        replacement: {
          contentText: text,
          color: new vscode.ThemeColor("textLink.foreground"),
          textDecoration: "underline",
        },
      },
    },
    hoverMessage: url,
  })));
}

function refreshAll(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    refresh(editor);
  }
  updateAtMarker(vscode.window.activeTextEditor);
}

/** Set while every caret rests at a marker's stop, so the Space keybinding fires only there. */
const AT_MARKER = "concealDemo.markup.atMarker";

/** The pair a caret rests against: at the opener's stop, behind it, or at the closer's, in front. */
function markerAt(document: vscode.TextDocument, position: vscode.Position): { pair: Pair; side: "opener" | "closer" } | undefined {
  for (const pair of pairs(document)) {
    if (position.isEqual(pair.opener.end)) {
      return { pair, side: "opener" };
    }
    if (position.isEqual(pair.closer.start)) {
      return { pair, side: "closer" };
    }
  }
  return undefined;
}

function updateAtMarker(editor: vscode.TextEditor | undefined): void {
  const at =
    editor !== undefined &&
    editor.document.uri.path.includes("/04-markup/") &&
    editor.selections.every((selection) => selection.isEmpty && markerAt(editor.document, selection.active) !== undefined);
  void vscode.commands.executeCommand("setContext", AT_MARKER, at);
}

/** Space at a marker's stop lands outside the pair: in front of an opener, behind a closer. The
 * editor would put it at the stop, inside the pair, where CommonMark no longer reads the marker.
 * Behind a closer the caret follows the space, to a place it cannot reach by itself. */
async function typeSpace(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const document = editor.document;
  const hits = editor.selections.map((selection) => (selection.isEmpty ? markerAt(document, selection.active) : undefined));
  if (hits.every((hit) => hit === undefined)) {
    await vscode.commands.executeCommand("default:type", { text: " " });
    return;
  }
  await editor.edit((builder) => {
    editor.selections.forEach((selection, index) => {
      const hit = hits[index];
      if (hit === undefined) {
        builder.replace(selection, " ");
      } else {
        builder.insert(hit.side === "opener" ? hit.pair.opener.start : hit.pair.closer.end, " ");
      }
    });
  });
  editor.selections = editor.selections.map((selection, index) => {
    if (hits[index]?.side !== "closer") {
      return selection;
    }
    // The stop is still in front of the closer; the space now sits right behind it.
    const closer = markerAt(document, selection.active)?.pair.closer;
    const after = closer ? closer.end.translate(0, 1) : selection.active;
    return new vscode.Selection(after, after);
  });
}

/** Ctrl+B with a selection inside a bold pair takes the selection out of it: the pair closes in
 * front of the selection, what follows it stays bold in a pair of its own, and the caret ends
 * behind the selection, outside. A selection in no pair is wrapped. */
async function toggleBold(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    return;
  }
  const document = editor.document;
  const range = new vscode.Range(editor.selection.start, editor.selection.end);
  const pair = pairs(document).find((candidate) => candidate.kind === "bold" && candidate.text.contains(range));
  if (!pair) {
    await editor.edit((builder) => {
      builder.insert(range.end, "**");
      builder.insert(range.start, "**");
    });
    return;
  }
  const before = document.getText(new vscode.Range(pair.text.start, range.start));
  const selected = document.getText(range);
  const after = document.getText(new vscode.Range(range.end, pair.text.end));
  const start = document.offsetAt(pair.opener.start);
  const rebuilt = (before ? `**${before}**` : "") + selected + (after ? `**${after}**` : "");
  await editor.edit((builder) => builder.replace(new vscode.Range(pair.opener.start, pair.closer.end), rebuilt));
  const caret = document.positionAt(start + (before ? before.length + 4 : 0) + selected.length);
  editor.selection = new vscode.Selection(caret, caret);
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    openingDecoration,
    closingDecoration,
    ...KINDS.map((kind) => kind.decoration),
    linkDecoration,
    vscode.window.onDidChangeVisibleTextEditors(refreshAll),
    vscode.workspace.onDidChangeTextDocument(refreshAll),
    vscode.window.onDidChangeActiveTextEditor(updateAtMarker),
    vscode.window.onDidChangeTextEditorSelection((event) => updateAtMarker(event.textEditor)),
    vscode.commands.registerCommand("conceal-demo.markup.space", typeSpace),
    vscode.commands.registerCommand("conceal-demo.markup.toggleBold", toggleBold),
  );
  refreshAll();
}
