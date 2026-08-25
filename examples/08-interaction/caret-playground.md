# Caret playground

## {!A3BF9Z} Crossing

Put the caret at the end of this line and hold the left arrow. #done

- One keypress crosses the hidden marker after `##`, in either direction.
- The `✅` drawn for `#done` has a stop on each side: two presses cross it, and each side is one end
  of the four characters it stands for.
- Type `X` with the caret on the right of `✅`. It lands after `#done`, not inside it.

## {!K71QMX} Deleting

Put the caret just after the hidden marker on this line and press Backspace once. #todo

- The whole marker goes, in one undo step. Press Ctrl+Z and it comes back whole.
- Ctrl+Backspace (delete word) takes it whole too.

## {!P02LDF} Selecting

Select this line from its end to its start with Shift+Home.

- The selection cannot stop inside the marker; both endpoints snap outward.
- Copy the selection and paste it somewhere else: what lands is `{!P02LDF} Selecting`, the text of
  the file, never the glyph.

## {!ZQGK9H} Revealing

Three reveal policies, none of which the editor knows about — each is the extension adding and
removing ranges as the selection changes.

- adjacent: (fold:this comes back when the caret rests against it)
- line:     (line:this comes back when a caret is anywhere on this line)
- selection:(sel:this comes back when a selection covers it)

Watch the line reflow as the text returns. That reflow is the reason every editor that shipped
*line*-scoped reveal regrets it.

## Finding

Run Find (Ctrl+F) and search for `P02LDF`.

- The match is found and can be navigated to — the document is untouched, so search sees the real
  characters.
- The match highlight has nowhere to draw, because the text it covers has no width. This is a gap
  no extension can close.
