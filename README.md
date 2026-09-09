# Conceal Demo

A showcase of the VS Code **conceal decoration options**: the proposed `concealedText` decoration option that
takes a run of text out of what the editor draws while the file keeps every character. It answers
[microsoft/vscode#171074](https://github.com/microsoft/vscode/issues/171074) and lives in a fork,
branch `concealed-text-1.135`; on a stock build the extension conceals nothing.

One folder per case under [src/cases](src/cases), each hardcoded and readable top to bottom, with
its example file under [examples](examples) and the recordings beside it. Ranges are found with
regular expressions because this is a demo; a real extension asks its language's parser.

**Out of scope: hiding whole lines.** Every case here conceals ranges inside one line. Leaving a
whole row out of the view is a separate question — what a deletion does where hidden and visible
rows meet, what the line-wise commands operate on — and it is kept apart, on the fork's
`conceal-1.135-lines` branch and this repository's `feature/lines`.

```bash
npm install
CONCEAL_DEMO_FORK=/path/to/vscode-fork ./scripts/dev.sh   # opens examples/ in the fork
```

`Conceal Demo: Toggle Concealment` flips `editor.conceal.enabled`, the editor's own switch, which
is how every recording shows what is really in the file.

## 1 — Tags

Shows basic replacement capabilities. Core functionality of proposal.

[src/cases/01-tags/tags.ts](src/cases/01-tags/tags.ts) · [examples/01-tags/tags.md](examples/01-tags/tags.md)

Replaces `#done` with one-symbol and `#bug` with multicharacter glyphs. "Tags to emoji" case is chosen as the most recognizable one. So specific LateX, or F# lamda syntax won't scare people. Replacement are really could be anything. See below to "Other Examples" section.

**Elsewhere:**:
- Vim's `conceal` with `cchar` (`:help conceal`)
- Emacs `prettify-symbols-mode`
- Obsidian Live Preview drawing tags as pills.

| The editor does | The extension does |
| --- | --- |
| hides the range and draws the replacement in its place | finds the ranges and picks the glyph |
| a caret stop on each side: one press or one word jump crosses it, ↑ and ↓ land on its nearest end | styles the replacement: colour, background, radius |
| Backspace, Delete and word delete take the whole tag, in one undo step | re-applies on every edit, so a tag that stops matching stops being concealed |
| selection, copy and Ctrl + F see the real text | - |

**Prior art.** Two extensions do this with a decoration and a setting named `adjustCursorMovement`,
which re-implements caret motion inside the extension. Their trackers show what that costs:

- [Prettify Symbols Mode](https://marketplace.visualstudio.com/items?itemName=siegebell.prettify-symbols-mode),
  23k installs, abandoned: [siegebell/vsc-prettify-symbols-mode#29](https://github.com/siegebell/vsc-prettify-symbols-mode/issues/29),
  the caret adjustment breaks on two-byte characters.
- [vsc-conceal](https://marketplace.visualstudio.com/items?itemName=BRBoer.vsc-conceal), its fork,
  abandoned: [rocq-community/vsc-conceal#4](https://github.com/rocq-community/vsc-conceal/issues/4),
  the caret drawn on the wrong side of the symbol, open since 2020.

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

**Concealment on and off**

![Concealment off with the four tags as text, then on with #done and #bug drawn as glyphs](examples/01-tags/0101-toggle.gif)

**Write tag**

![todo deleted letter by letter, done typed until the glyph appears, broken by one more letter and back](examples/01-tags/0109-typing.gif)


**Search finds the text under the glyph**

![Ctrl+F finding done under its glyph and bug under its chip, concealment off showing each match on the real text](examples/01-tags/0102-search.gif)

**What the clipboard carries**

![Two lines, then the glyph alone, then the chip alone pasted into a tab beside: the tags, not the glyphs](examples/01-tags/0103-copy.gif)

**The caret around a glyph**

![The caret crossing the glyph and the chip in one press, word jumps landing past them, and the same keys on the raw text with concealment off](examples/01-tags/0104-caret.gif)

**A caret inside the range when concealment returns**

![The caret parked inside #done and then inside #bug with concealment off, pushed out when concealment comes back](examples/01-tags/0105-inside.gif)

**Deleting a glyph**

![Backspace, Ctrl+Backspace and Ctrl+Delete taking the whole tag, for the glyph and for the chip, concealment off proving it, undo bringing it back](examples/01-tags/0106-delete.gif)

**Two carets, two glyphs**

![Two carets deleting, restoring and typing braces around two glyphs at once](examples/01-tags/0107-multicursor.gif)

**The caret up and down through glyph lines**

![Up and down landing on the nearest end of a glyph, never inside it](examples/01-tags/0108-vertical.gif)


## 3 — Translation

Shows a replacement no configuration can reach: computed per range, from a source outside the file.
Two files, one mechanism.

[src/cases/03-i18n/i18n.ts](src/cases/03-i18n/i18n.ts) · [examples/03-i18n/comments.ts](examples/03-i18n/comments.ts) · [examples/03-i18n/checkout.ts](examples/03-i18n/checkout.ts)

**Comments in another language.** [comments.ts](examples/03-i18n/comments.ts) is written with Spanish
comments; each one is concealed and its English drawn in its place, from
[comments.en.json](examples/03-i18n/comments.en.json). The `//` stays visible, so the line still
reads as a comment. A comment the catalogue does not answer is left in Spanish.

**Translation keys.** [checkout.ts](examples/03-i18n/checkout.ts) calls `t("cart.empty")`; the call
is concealed and the string from [messages.en.json](examples/03-i18n/messages.en.json) drawn in its
place. A key with no entry stays as written.

The catalogues stand in for whatever a real extension asks — a translation service, a language
server, a bibliography. Edit one and the source redraws with no edit of its own, saved or not; a
catalogue that stops parsing brings every string back as text.

What separates this from case 1 is that the vocabulary is unbounded: the string drawn cannot be
rebuilt from the text that matched. A replacement carried by the decoration *type* would need one
type per distinct string, and the count would grow with the file rather than with the extension.
`DecorationOptions` carries `conceal.replacement` per range instead, so one type serves them all.

**Extensions today:**
[Comment Translate](https://marketplace.visualstudio.com/items?itemName=intellsmi.comment-translate),
701k installs, 4.9, actively maintained. Its immersive mode draws the translation *in place of* the
comment — with `textDecoration: "none; display: none;"` on the original and a `before` attachment
carrying the translation ([commentDecoration.ts#L189-L218](https://github.com/intellism/vscode-comment-translate/blob/008012f76816c1f57c3e05846c77ed01fea72f2c/src/languageFeature/commentDecoration.ts#L189-L218)),
and it [removes the projection while the caret is inside the block](https://github.com/intellism/vscode-comment-translate/blob/008012f76816c1f57c3e05846c77ed01fea72f2c/src/languageFeature/commentDecoration.ts#L249-L256),
because the caret would otherwise walk through characters nobody can see.
[i18n Ally](https://marketplace.visualstudio.com/items?itemName=Lokalise.i18n-ally), 1.03M installs,
the largest base in this survey, draws the translation with an `after` decoration, so the key stays
and the line grows; stalled since 2024-12 with 475 issues open, among them
[#1215](https://github.com/lokalise/i18n-ally/issues/1215): stuck brackets, an invisible cursor,
undefined lines.

| The editor does | The extension does |
| --- | --- |
| hides the range and draws the string given for that one range | reads the catalogue and maps what is written → what is drawn |
| keeps the caret out: one press crosses it, one delete takes it whole, so no projection has to be dropped near the caret | re-applies when a catalogue changes, saved or not |
| keeps copy, search and diff on what is really written | leaves an unanswered string visible, and hovers the original under a translation |

```ts
// One type for every string drawn: only the replacement varies, and it travels with the range.
const translationDecoration = vscode.window.createTextEditorDecorationType({
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  conceal: {},
});

editor.setDecorations(translationDecoration, matches.map((match) => ({
  range: match.range,
  renderOptions: { conceal: { replacement: { contentText: catalogue[match.text] } } },
  hoverMessage: `\`${match.text}\``,
})));
```

The long comment in `comments.ts` is drawn cut, ending in `…`: replacements are capped by
`editor.conceal.maximumReplacementLength`, 43 characters by default, `0` to never truncate.

## 7 — Fold

[src/cases/07-fold/fold.ts](src/cases/07-fold/fold.ts) · [examples/07-fold/index.html](examples/07-fold/index.html)

Long `class` attributes folded to a bold `•••` chip. A fold opens when the caret reaches it and
closes when the caret leaves; the setting `conceal-demo.foldReveal` picks whether any key opens it
or a mouse click only.

**Elsewhere:** JetBrains folds inside a line with placeholder text. VS Code folds whole lines only:
[microsoft/vscode#50840](https://github.com/microsoft/vscode/issues/50840) asks for folding inside
a line, 171 👍, open since 2018, and the folding owner answered three times that it needs the editor
core and cannot come from an extension. [#3352](https://github.com/microsoft/vscode/issues/3352),
310 👍, asks for the closing brace on the same line, a special case of it.

**Extensions today:** [Inline Fold](https://marketplace.visualstudio.com/items?itemName=moalamri.inline-fold),
305k installs, and [Tailwind Fold](https://marketplace.visualstudio.com/items?itemName=stivo.tailwind-fold),
337k, hide the characters with a CSS trick and draw `…`. Both are unmaintained: Inline Fold's author
lost the publisher account and declared it dead in 2024 ([discussion #132](https://github.com/moalamri/vscode-inline-fold/discussions/132),
[#137](https://github.com/moalamri/vscode-inline-fold/issues/137)); Tailwind Fold has had no release
since 2024-06, with 40 issues open. So there is no side-by-side recording for this case.

**What concealment changes for a fold**

- **A folded row is as short as it looks.** Hidden characters still take their room under word
  wrap; the maintainer of Inline Fold explains why he cannot fix that in
  [discussion #69](https://github.com/moalamri/vscode-inline-fold/discussions/69), and
  [tailwind-fold#6](https://github.com/stivoat/tailwind-fold/issues/6) shows the hole. Concealed,
  the editor lays the line out from what it draws.
- **The caret cannot fall into hidden text.** With the trick, arrow keys walk through invisible
  characters and Backspace eats them, so the extensions must unfold whatever the caret or a
  selection touches, and that fights the selection ([inline-fold#119](https://github.com/moalamri/vscode-inline-fold/issues/119),
  reproduced, never fixed). Concealed, a key jumps over the fold and a delete takes it whole, so
  the extension picks when a fold opens: when the caret reaches it, on a click, or never.
- **One switch for all of it.** `editor.conceal.enabled` and `editor.conceal.inDiffEditor` belong
  to the editor, not to each extension ([inline-fold#136](https://github.com/moalamri/vscode-inline-fold/issues/136),
  [tailwind-fold#40](https://github.com/stivoat/tailwind-fold/issues/40)).

Opening a fold with a click works either way: a click on the drawn text puts the caret at the
fold's edge, which the extension sees, just as a click on the extensions' `…` does.

| The editor does | The extension does |
| --- | --- |
| hides the value and draws the text given for that range | finds the values and picks the ones long enough to fold |
| keeps the caret out of the fold: one press crosses it, one delete takes it | decides what opens a fold: any arrival, or a click |
| keeps copy, search and undo on the real text | re-applies on every edit and caret move |

```ts
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

editor.setDecorations(foldDecoration, longValues);
```

**Long class lists folded, one row each**

![Concealment off with three class lists wrapping over six rows, then on with each folded to one row](examples/07-fold/0701-fold.gif)

**A fold opens when the caret reaches it**

![The caret reaching a fold with the arrow key and the value opening, the caret leaving and the fold closing, then with click-only reveal the caret jumping over the closed fold](examples/07-fold/0702-reveal.gif)

**A click opens a fold**

<!-- Filmed by hand: ./scripts/record.sh 0704, then take this line out of the comment.
![A click on a folded value opening it, a click elsewhere closing it](examples/07-fold/0704-click.gif)
-->

A concealed range stays within one line, so a value written over several lines is left alone here.
Folding one of those to a single row means laying one view row out from several model lines — the
whole-line question above — and it lives on `feature/lines`.

## Recording

The GIFs are played by the extension's own recorder and photographed by
[scripts/record.sh](scripts/record.sh) on WSLg; its header lists the requirements.

```bash
CONCEAL_DEMO_FORK=/path/to/vscode-fork CONCEAL_DEMO_WINSHOT=/path/to/winshot.ps1 \
  ./scripts/record.sh 07         # case 7; `0701 0702` picks scenes
```

A step marked `manual` in [examples/scenes.json](examples/scenes.json) is filmed by hand: the
recorder sets the scene up and sizes the window, the Windows ffmpeg films the workbench rectangle
with the pointer in it until Enter is pressed in the terminal, and the clip gets its caption like
any frame. That is how the mouse scenes are made, since nothing in the pipeline can move the mouse.

A scene that shows another extension beside the API needs it installed: the pinned ones in
[scripts/compare-extensions.txt](scripts/compare-extensions.txt) go into the recording profile unless
`CONCEAL_DEMO_NO_COMPARE=1` is set, and every scene states with a setting whether that extension is on.
