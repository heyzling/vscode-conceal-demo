# Examples

One folder per group of the case survey. Open a file and the rules in
[default-rules.json](default-rules.json) fire on it; every folder's `README.md` says what to look
at and what to press.

| Folder | Group | What it demonstrates |
| --- | --- | --- |
| [01-syntax-elision](01-syntax-elision) | G1 | Hide markup, draw nothing. The cheapest case, fully served. |
| [02-symbol-substitution](02-symbol-substitution) | G2 | A fixed table of glyphs. One decoration type per glyph. |
| [03-machine-metadata](03-machine-metadata) | G3 | Machine-written ids, hidden outright, with a declared caret stop. |
| [04-semantic-projection](04-semantic-projection) | G4 | A replacement computed per occurrence — where the type count explodes. |
| [05-bulk-collapse](05-bulk-collapse) | G5 | A placeholder that opens on demand, and the click it cannot detect. |
| [06-redaction](06-redaction) | G6 | Masking, width preservation, and the 16-character cap. |
| [07-line-elision](07-line-elision) | G7 | A fence chip that works, and frontmatter that leaves blank lines. |
| [08-interaction](08-interaction) | G8 | Crossing, deleting, selecting, copying, finding, revealing. |

Nothing in these files is rewritten. Every character you cannot see is still on disk — `git diff`
after a session of reading them is empty, and that is the property the whole approach exists to
keep.

## Running them

The rules are scoped by `conceal-demo.include`, which defaults to `["**/examples/**"]`. Opening
this folder as the workspace is therefore enough, and nothing outside it is touched.
