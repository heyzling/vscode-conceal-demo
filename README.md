# VS Code Conceal Demo

A showcase of the VS Code **conceal decoration options**.

- [VS Code Conceal Demo](#vs-code-conceal-demo)
   - [1 — Tags](#1--tags)
   - [2 — Dynamic replacement](#2--dynamic-replacement)
   - [3 — Invisible metadata](#3--invisible-metadata)
   - [4 — Hide Markdown markup](#4--hide-markdown-markup)
   - [5 — Gallery](#5--gallery)
   - [Implementation](#implementation)
   - [Run](#run)
   - [Links](#links)




## 1 — Tags

**Shows:**
- text -> glyph replacement
- cursor movement
- `deletionPolicy: atomic` behavior

**Paths:**
- Logic: [src/cases/01-tags/tags.ts](src/cases/01-tags/tags.ts)
- Example: [examples/01-tags/tags.md](examples/01-tags/tags.md)

**What it does:**
Replaces `#done` with a one-symbol glyph and `#bug` with a multi-character one. The "tags to emoji" case was chosen as the most recognizable one, so LaTeX- or F#-specific syntax won't scare people off. The replacement could really be anything: see the "Gallery" section below.

**Conceal decoration shape for this example**
```ts
const doneDecoration = vscode.window.createTextEditorDecorationType({
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  conceal: { replacement: { contentText: "✅" } },
});

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

editor.setDecorations(doneDecoration, findRanges(editor.document, /#done\b/g));
```

**1 — Concealment on and off**

![Concealment off with the four tags as text, then on with #done and #bug drawn as glyphs](examples/01-tags/0101-toggle.gif)

**2 — Search finds the text under the glyph**

![Ctrl+F finding done under its glyph and bug under its chip, concealment off showing each match on the real text](examples/01-tags/0102-search.gif)

**3 — What the clipboard carries**

![Two lines, then the glyph alone, then the chip alone pasted into a tab beside: the tags, not the glyphs](examples/01-tags/0103-copy.gif)

**4 — The cursor around a glyph**

![The cursor crossing the glyph and the chip in one press, word jumps landing past them, and the same keys on the raw text with concealment off](examples/01-tags/0104-caret.gif)

**5 — A cursor inside the range when concealment returns**

![The cursor parked inside #done and then inside #bug with concealment off, pushed out when concealment comes back](examples/01-tags/0105-inside.gif)

**6 — Deleting a glyph (atomic)**

![Backspace, Ctrl+Backspace and Ctrl+Delete taking the whole tag, for the glyph and for the chip, concealment off proving it, undo bringing it back](examples/01-tags/0106-delete.gif)

**7 — Two cursors, two glyphs**

![Two cursors deleting, restoring and typing braces around two glyphs at once](examples/01-tags/0107-multicursor.gif)

**8 — The cursor up and down through glyph lines**

![Up and down landing on the nearest end of a glyph, never inside it](examples/01-tags/0108-vertical.gif)

**9 — Writing a tag**

![todo deleted letter by letter, done typed until the glyph appears, broken by one more letter and back](examples/01-tags/0109-typing.gif)


## 2 — Dynamic replacement

**Shows:**
- dynamic text replacement
- `deletionPolicy: reveal` behavior

**Paths:**
- Logic: [src/cases/02-i18n/i18n.ts](src/cases/02-i18n/i18n.ts)
- Example: [examples/02-i18n/checkout.ts](examples/02-i18n/checkout.ts), [examples/02-i18n/comments.ts](examples/02-i18n/comments.ts)

**What it does:**
Replaces one text with another:
- TS code with static values underneath replaced with said values.
- Comments in Spanish replaced with an English translation

Imitated with a hardcoded JSON config, but in a real extension values can arrive from anywhere: a translation service, a language server, a bibliography, etc.

Here is where `deletionPolicy: reveal` works great. Often you don't want to delete the whole replacement at once as in the tags example. You want to edit the real text underneath. This policy automatically reveals the real text on Backspace/Delete against a concealed range.

**Conceal decoration shape for this example**
```ts
// One type for every string drawn: only the replacement varies, and it travels with the range.
const translationDecoration = vscode.window.createTextEditorDecorationType({
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  conceal: { deletionPolicy: "reveal" },
});

editor.setDecorations(translationDecoration, matches.map((match) => ({
  range: match.range,
  renderOptions: { conceal: { replacement: { contentText: catalogue[match.text] } } },
  hoverMessage: `\`${match.text}\``,
})));
```

**1 — Concealment on and off**

![Concealment off with the translation keys as code, then on with the strings from the catalogue drawn in their place](examples/02-i18n/0201-toggle.gif)

**2 — Wrap works on what is visible**

![A Spanish comment wrapped over three rows with concealment off, its English translation on one row with concealment on](examples/02-i18n/0202-wrap.gif)

**3 — A delete key reveals the text**

The first `Backspace` only reveals the real text. The second actually deletes it.

![Backspace beside a drawn string showing the key and deleting nothing, a second Backspace taking a character, undo, then the cursor moving on and the string drawn again](examples/02-i18n/0203-delete.gif)

**4 — A key edited under the drawn string**

![Backspace revealing the key, Ctrl+Backspace taking its last segment, a new one typed, the cursor moving on and the new string drawn](examples/02-i18n/0204-edit.gif)

## 3 — Invisible metadata

**Shows:**
- concealment with nothing drawn in its place
- `anchor: lineEnd`
- `deletionPolicy: protect` behavior

**Paths:**
- Logic: [src/cases/03-invisible-metadata/metadata.ts](src/cases/03-invisible-metadata/metadata.ts)
- Example: [examples/03-invisible-metadata/notes.md](examples/03-invisible-metadata/notes.md)

**What it does:**
Hides machine metadata: note IDs in this example.

- `my note ^a3f9c1` -> `my note`
- `this is my link [[Note#^id]]` -> `this is my link [[Note]]`

**Conceal decoration shape for this example**
```ts
const idDecoration = vscode.window.createTextEditorDecorationType({
  conceal: { anchor: "lineEnd", deletionPolicy: "protect" },
});
```

**1 — Block ids on and off**

![Concealment off with the block ids as text, then on with nothing in their place](examples/03-invisible-metadata/0301-toggle.gif)

**2 — The cursor crosses an id**

![Two presses right crossing a hidden id and a bracket, two back, then concealment off showing the eight characters crossed in one press](examples/03-invisible-metadata/0302-caret.gif)

**3 — Backspace skips an id**

![Three Backspaces at the end of a line taking the last word and its period, concealment off showing the id behind them untouched](examples/03-invisible-metadata/0303-backspace.gif)

**4 — Delete skips an id**

![Delete at the end of a line stepping over the id and joining the next line, concealment off showing the id still closing the line](examples/03-invisible-metadata/0304-delete.gif)

**5 — A word typed at the line end**

![A word typed at the end of a line, concealment off showing it in front of the id that still closes the line](examples/03-invisible-metadata/0305-typing.gif)

**6 — Enter at the line end**


![Two Enters at the end of a line opening two empty lines below it, concealment off showing the id still on the line above](examples/03-invisible-metadata/0306-enter.gif)

**7 — What the clipboard carries**

The ID is copied only if the next line is also selected.

![A paragraph, then a selection to the line end, each pasted into a tab beside: the id comes with whole lines and not with the text before it](examples/03-invisible-metadata/0307-copy.gif)

**8 — What the clipboard carries around a hidden ref**

![One bracket next to the hidden ref, then the whole wikilink, each pasted into a tab beside: the bracket comes alone, the wikilink with its ref as real text](examples/03-invisible-metadata/0308-copyref.gif)

## 4 — Hide Markdown markup

**Shows:**
- concealed markup
- `anchor: after` on the opening marker, `anchor: before` on the closing one
- `deletionPolicy: protect` behavior
- a link drawn as its text: per-range `replacement`, `deletionPolicy: reveal`

**Paths:**
- Logic: [src/cases/04-markup/markup.ts](src/cases/04-markup/markup.ts)
- Example: [examples/04-markup/emphasis.md](examples/04-markup/emphasis.md)

**What it does:**
- Hides Markdown emphasis: `**bold**`, `_italic_` and `` `code` `` read as the styled word alone.
- `[My link example](https://example.com)` -> [My link example](https://example.com)

Opens the gate to live Markdown editing as in [Obsidian Live Preview](https://obsidian.md/help/edit-and-read).

Related to the VS Code feature request: [#286296 Support decorations that hide characters](https://github.com/microsoft/vscode/issues/286296).


**Conceal decoration shape for this example**
```ts
const openingDecoration = vscode.window.createTextEditorDecorationType({
  conceal: { anchor: "after", deletionPolicy: "protect" },
});

const closingDecoration = vscode.window.createTextEditorDecorationType({
  conceal: { anchor: "before", deletionPolicy: "protect" },
});

const boldDecoration = vscode.window.createTextEditorDecorationType({ fontWeight: "bold" });

// A link is one range drawing its own text
const linkDecoration = vscode.window.createTextEditorDecorationType({
  conceal: { deletionPolicy: "reveal" },
});

// Every pair as its opener, text and closer, from one expression per kind: /\*\*([^*]+)\*\*/g
const found = pairs(editor.document);
editor.setDecorations(openingDecoration, found.map((pair) => pair.opener));
editor.setDecorations(closingDecoration, found.map((pair) => pair.closer));
editor.setDecorations(boldDecoration, found.filter((pair) => pair.kind === "bold").map((pair) => pair.text));

// Every `[text](url)`, drawn as its text.
editor.setDecorations(linkDecoration, links(editor.document).map(({ range, text, url }) => ({
  range,
  renderOptions: { conceal: { replacement: { contentText: text, color: new vscode.ThemeColor("textLink.foreground"), textDecoration: "underline" } } },
  hoverMessage: url,
})));
```

**1 — Markers on and off**

![Concealment off with the markers and the link as text, then on with the words styled, the markers gone and the link drawn as its text](examples/04-markup/0401-toggle.gif)

**2 — A hidden marker costs no keypress**

![One press carrying the cursor over a space and the hidden opening marker, back the same way, then concealment off showing four characters at one press each](examples/04-markup/0402-caret.gif)

**3 — Typing at either visible edge stays inside the pair**

![semi typed at the visible start of bold and face at the visible end of another, concealment off showing both words grown inside their markers](examples/04-markup/0403-typing.gif)

**4 — A space at the visible end lands outside the pair**

![A space and a word typed at the visible end of bold, the word plain, concealment off showing the space behind the closing marker](examples/04-markup/0404-space.gif)

**5 — Enter at the visible end leaves the pair whole**

![Enter at the visible end of bold moving the rest of the line down, concealment off showing the closing marker still on its line](examples/04-markup/0405-enter.gif)

**6 — No delete key reaches a marker**

![Backspace at the visible end of bold taking the letter, Delete taking the space behind the closing marker, concealment off showing both markers untouched](examples/04-markup/0406-protect.gif)

**7 — A marker without a partner shows itself**

![One asterisk deleted with concealment off, concealment on leaving both halves in view, undo restoring the pair, hidden again at once](examples/04-markup/0407-orphan.gif)

**8 — A link shows itself on Backspace and hides again**

![Backspace after a link showing the whole link and deleting nothing, the url edited in place, the cursor leaving and the link drawn again, concealment off showing the new url](examples/04-markup/0408-link.gif)

**9 — Delete takes exactly what the selection covers**

![Two word selections reaching over bold and its hidden markers, Delete taking the pair whole, a word selection back to the start of another bold covering its opening marker, Backspace taking it and leaving the closing marker in view, concealment off showing both lines](examples/04-markup/0409-selection.gif)

## 5 — Gallery

Small examples inspired by other extensions, editors and open VS Code issues.

**Shows:**
- JSON keys: `"name":` as `name:` — `anchor: after` / `anchor: before` on the quotes, `deletionPolicy: protect`.
- F# lambda: `fun` as λ, `->` as →
- TS arrow: `=>` as one ⇒
- LaTeX macros: `\alpha` as α, from a table — `deletionPolicy: reveal`
- Tag rotation: `#todo` as 🟨, `#done` as ✅, a click on the glyph rewrites the tag
- Inline fold: a long `class` value as a `•••` chip, a click unfolds it and a chip at its start folds it again — `deletionPolicy: reveal`

**Paths:**
- Logic: [src/cases/05-gallery](src/cases/05-gallery) — [jsonKeys.ts](src/cases/05-gallery/jsonKeys.ts) · [fsharpLambda.ts](src/cases/05-gallery/fsharpLambda.ts) · [tsArrow.ts](src/cases/05-gallery/tsArrow.ts) · [latexMacros.ts](src/cases/05-gallery/latexMacros.ts) · [tagRotation.ts](src/cases/05-gallery/tagRotation.ts) · [fold.ts](src/cases/05-gallery/fold.ts)
- Example: [examples/05-gallery](examples/05-gallery) — [config.json](examples/05-gallery/config.json) · [lambda.fs](examples/05-gallery/lambda.fs) · [arrow.ts](examples/05-gallery/arrow.ts) · [formula.tex](examples/05-gallery/formula.tex) · [todo.md](examples/05-gallery/todo.md) · [card.html](examples/05-gallery/card.html)

**1 — JSON keys**

![A new key typed into a JSON file, its quotes vanishing at the colon, the cursor crossing the hidden quote in one press and the key growing inside its quotes](examples/05-gallery/0501-json.gif)

**2 — F# lambda**

![A new F# function typed, fun and the arrow drawn as their symbols as they are typed](examples/05-gallery/0502-fsharp.gif)

**3 — TS arrow**

![A new arrow function typed, the arrow drawn as one symbol the moment it is complete](examples/05-gallery/0503-tsarrow.gif)

**4 — LaTeX macros**

![A formula typed with each macro drawn as it completes, Backspace on π showing the macro, a second Backspace taking its last letter, the letter typed back and π drawn again](examples/05-gallery/0504-latex.gif)

**5 — Tag rotation**

![A box glyph rotated to a check mark and back by the command](examples/05-gallery/0505-tags.gif)

**6 — Inline fold**

![Three folded class lists, Backspace at one showing the value and deleting nothing, a word typed into it, the cursor leaving and the value folded again](examples/05-gallery/0506-fold.gif)

**7 — Inline fold, by click**

![A click on the folded chip unfolding the value, a chip appearing at its start, a click on that chip folding it again](examples/05-gallery/0507-fold-click.gif)


## Implementation

Each case lives in its own folder, `src/cases/<NN-name>/`. It only works on files in the matching `examples/<NN-name>` dir.

All parsing is done with regexp. Real extensions should use specialized parsers instead.


## Run

```bash
npm install
CONCEAL_DEMO_FORK=/path/to/vscode-fork ./scripts/dev.sh   # opens examples/ in the fork
```

ON/OFF concealment via command: `Conceal Demo: Toggle Concealment`.
<!-- grammar: no verb, missing article: "Toggle concealment on/off via the command: …" -->


## Links

1. Proposal: [Concealed text — a proposed VS Code API (v4) · GitHub](https://gist.github.com/heyzling/6235fd30bda7605199963e15f12142f5)
1. Implementation: [VS Code Fork concealed-text-1.135 branch](https://github.com/heyzling/vscode/tree/concealed-text-1.135)
1. 2023, motivating request, still open, Backlog, 60 👍: [#171074 Feature request: prettify symbols mode](https://github.com/microsoft/vscode/issues/171074)