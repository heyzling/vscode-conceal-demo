# G7 — line elision

The unit is a whole line. Neovim added `conceal_lines` in 0.11 for exactly this, because hiding a
fence's *text* leaves a blank line where the fence was.

Rules: `g7-view-open-chip`, `g7-view-close-chip` (fences.md), `g7-frontmatter-line`
(frontmatter.md).

What to look for:

- **`fences.md` — the chip variant works today.** The fence's whole text is one single-line range,
  so replacing it with `▸ …` needs nothing the API does not have. It is *not* blocked on line
  elision, which is worth knowing before the feature is prioritised.
- **The chip is cut.** `▸ #todo !#done · 20` is 19 characters and the cap is 16, so what you see
  ends at `·`. The replacement a real consumer wants here does not fit.
- **The chip is one decoration type per query string**, and query strings are unbounded — the same
  wall as [04](../04-semantic-projection/README.md).
- **`frontmatter.md` — the hide-entirely variant does not work.** Four hidden lines leave four
  empty lines. This is the case that needs a second primitive.
- **And those four lines lose their line numbers.** Look at the gutter: it runs 1, then 6. The
  editor draws a number only when view column 1 of a row maps back to model column 1, and a line
  concealed whole with the default `cursorStop: "after"` maps column 1 to the *end* of the hidden
  run instead. The row then looks like a wrapped continuation of the line above it.
  Setting `"cursorStop": "before"` on the rule brings every number back — the blank rows stay,
  because that is the real gap, but the gutter stops lying. Worth knowing before a rule ever
  conceals a whole line.
