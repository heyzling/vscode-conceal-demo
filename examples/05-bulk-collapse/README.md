# G5 — bulk collapse

A long, uninteresting run collapses to a placeholder the reader opens on demand. The one group
where revealing is the point rather than a concession.

Rule: `g5-class-list` — `reveal: "adjacent"`, `hover: true`.

What to look for:

- The first class stays visible and the rest becomes `…`, which is what *Tailwind Fold With Class
  Names* does with a CSS hack.
- **Click the `…`.** Nothing happens: the caret arrives at the collapse point, the rule notices it
  is adjacent, and the text comes back — but the extension cannot tell a click *on the placeholder*
  from a click on the character beside it, because a concealed range has no width to hit-test
  against. The CSS-decoration version of this extension category is genuinely more precise here.
- **Watch the line reflow** as the caret arrives. Every reveal policy costs this.
