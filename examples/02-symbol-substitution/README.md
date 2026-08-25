# G2 — symbol substitution

A token from a fixed vocabulary is drawn as a shorter one. This is the group the standing upstream
request ([#171074](https://github.com/microsoft/vscode/issues/171074)) is entirely about.

Rules: `g2-tex-forall`, `g2-tex-in`, `g2-tex-alpha`, `g2-tex-beta`, `g2-tex-gamma`,
`g2-tex-rightarrow`, `g2-ts-fat-arrow`.

What to look for: **seven rules for seven glyphs.** The replacement is a property of the decoration
type, so a vocabulary of N tokens costs N rules and N decoration types — run
**Conceal Demo: Show Statistics** and read `created total`. That is fine here, because the
vocabulary is fixed and small. Group 4 is where it stops being fine.

Also worth doing: put the caret to the right of `∀` and press the left arrow once. One keypress
crosses the whole `\forall`, and the glyph has a side of its own on each end.
