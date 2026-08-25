# G8 — interaction

Not a thing to hide: the behaviour every other group inherits, and where every implementation
surveyed has failed at least once. This is what an extension is actually buying from the editor —
none of it is implementable outside it.

Rules: `g8-hidden-marker`, `g8-drawn-done`, `g8-drawn-todo`, `g8-reveal-adjacent`,
`g8-reveal-line`, `g8-reveal-selection`.

Work through [caret-playground.md](caret-playground.md) with the keyboard. Each line says what to
press and what should happen.

[fixture.md](fixture.md) and [fixture-after.md](fixture-after.md) are the same three lines under
the two possible caret stops — `cursorStop: "before"` and `cursorStop: "after"`. They are what the
interaction suite drives, and they are worth opening side by side: put the caret against the hidden
marker in each and press Backspace. In `fixture.md` the marker's single position **is** its start,
so Backspace eats the space in front of it and Delete takes the marker; in `fixture-after.md` the
position is its end, so the two keys swap roles. Neither file can put a caret at the marker's other
end at all — that end has no screen position to reach.
