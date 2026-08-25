# G6 — redaction

The same primitive as every other group, with a different promise attached: here a leak is a
disclosure, not a cosmetic glitch.

Rule: `g6-env-value` — `padToWidth: true`, `padWith: "•"`.

What to look for:

- The values are masked and the columns after them do not move, because the mask is padded to the
  width of what it hides. That is width-preserving concealment, done by the extension, with no
  editor feature behind it.
- **It stops at 16 characters.** The editor cuts every replacement to 16, so a 43-character secret
  is masked by a 16-character run of bullets and everything after it still shifts. Run
  **Conceal Demo: Show Statistics** and read `could not be padded`.
- **The text is still there.** Copy a masked line. Search for `sk-live`. Open the minimap. Ask
  another extension to read the document. Concealment is a rendering feature and not a security
  boundary, and this folder is the demonstration rather than the disclaimer.
