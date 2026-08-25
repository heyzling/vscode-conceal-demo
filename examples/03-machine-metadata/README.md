# G3 — machine metadata

Text a tool wrote into the file for its own use, which a human never edits: identity anchors,
property lines, generated ids. Hidden outright, and never revealed.

Rules: `g3-record-id` (notes.md), `g3-record-id-badge` (notes-badge.md), `g3-obsidian-block-id`
and `g3-logseq-property` (properties.md), `g3-nix-store-hash` (store-paths.md).

What to look for:

- **`notes.md` vs `notes-badge.md`** — the same marker, hidden outright in one and drawn as `°` in
  the other. `cursorStop: "before"` is set in both, and it is only *read* in the first: anything
  drawn has a left and a right side of its own, so there is nothing left to declare.
- **Type `1. ` at the start of the second heading in `notes.md`.** With `cursorStop: "before"` the
  text lands in front of the hidden marker. Set it to `"after"` in your settings and the same
  keystrokes land inside the note instead.
- **Break a marker** — delete one character out of `{!A3BF9Z}`. It stops matching, so it stops
  being concealed, and the damage is loud. Concealment is derived, never stored.
