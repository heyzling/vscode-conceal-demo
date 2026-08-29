# Conceal Demo

A playground for the VS Code **conceal API** — the proposed `concealedText` decoration option that
takes a run of text out of what the editor renders while the file keeps every character.

The point of this extension is to find out how far *pure configuration* gets. Concealment is, at
bottom, a grep with instructions about what to draw instead, so every rule here is a regular
expression in a settings file. Where that stops working is the interesting result, and it is
written down in [what pure configuration cannot reach](#what-pure-configuration-cannot-reach).

> The API is a **proposal**, and one that lives in a fork rather than upstream
> ([microsoft/vscode#171074](https://github.com/microsoft/vscode/issues/171074) is the request it
> answers). Without it this extension conceals nothing, says so once, and gets out of the way.

## Requirements

A build of VS Code carrying the `concealedText` proposal, and a grant to use it. Running the fork
from sources gives every extension every proposal it declares, which is what `scripts/dev.sh` does:

```bash
npm install
CONCEAL_DEMO_FORK=/path/to/vscode-fork ./scripts/dev.sh
```

An **installed** build grants proposals through its own `product.json`:

```json
"extensionEnabledApiProposals": {
  "heyzling.conceal-demo": ["concealedText"]
}
```

On any other build the extension detects that it cannot conceal, warns once, and does nothing else.

## Getting started

`scripts/dev.sh` opens [examples/](examples) as the workspace, which is all the demo needs:
`conceal-demo.include` defaults to `["**/examples/**"]`, so nothing outside that folder is touched
even though the rules ship enabled.

Then open any file under `examples/` and read [examples/README.md](examples/README.md) — one
section per group, each linking the file, naming the rule that fires on it, and showing a recording
of the behaviour. Start with group 1, then read group 6 for the case the same idea cannot serve.

## How it is configured

| Setting | Default | What it is for |
| --- | --- | --- |
| `conceal-demo.enabled` | `true` | Master switch. |
| `conceal-demo.include` | `["**/examples/**"]` | Glob patterns a file must match before **any** rule runs. The blast-radius guard. |
| `conceal-demo.rules` | `[]` | Your rules. |
| `conceal-demo.exampleRules` | the shipped set | The demo rules, kept in their own setting so they never mix with yours. |
| `conceal-demo.disableExamples` | `false` | Ignore `exampleRules` entirely. |
| `conceal-demo.maxMatchesPerFile` | `2000` | Stop after this many matches in one file. |
| `conceal-demo.trace` | `false` | Log every recomputation. |

A rule:

```jsonc
{
  "id": "record-id",                       // for the log and the statistics
  "files": ["**/notes/*.md"],              // globs, on top of conceal-demo.include
  "languages": ["markdown"],               // language ids, optional
  "pattern": "\\{![A-Za-z0-9]{6}\\} ",     // matched line by line; 'g' and 'd' are always on
  "flags": "i",                            // extra flags; 'm', 's', 'y' are refused
  "group": 0,                              // which capture group to conceal
  "replaceWith": "",                       // "" hides; "$1"/"$&" build a string per occurrence
  "cursorStop": "before",                  // read only when nothing is drawn
  "padToWidth": false,                     // pad the replacement to the hidden text's width
  "padWith": " ",                          // what to pad with — "•" for a mask
  "hover": false,                          // show the concealed text on hover
  "reveal": "never",                       // never | adjacent | line | selection
  "style": { "color": "theme:editorCodeLens.foreground" }
}
```

`style.color` and `style.backgroundColor` take a CSS colour or `theme:<colour-id>`.

The shipped set is [examples/default-rules.json](examples/default-rules.json), which is also the
default of `conceal-demo.exampleRules` in `package.json` — one source of truth, copied by
`npm run sync-example-rules` and checked by the tests. Paste that file's contents straight into a
`settings.json` to start from it.

## Commands

- **Conceal Demo: Toggle Concealment**
- **Conceal Demo: Show Statistics** — rules loaded, spans found, and the two numbers the API's shape
  produces: how many decoration types have been created, and how many replacements the editor cut.
- **Conceal Demo: Show Log**

## What pure configuration reaches

One folder of [examples/](examples) per group of the case survey behind this work, each with a
recording beside every file it demonstrates. The survey is being re-cut one group at a time; what
is in the repository today is the first group and the wall behind it.

| Group | Case | Reached by a regex rule? |
| --- | --- | --- |
| [1 — hide](examples/README.md#1--hide-symbols) | Hide a run of text, draw nothing | Yes |
| [2 — replace](examples/README.md#2--replace-symbols) | Draw a glyph or a shorter string in its place | Yes, at one decoration type per string drawn |
| [6 — not implemented](examples/README.md#6--not-implemented) | Hide a line that exists only for its text | No — the row stays, and needs a second primitive |

Still to be re-cut: caret and edit behaviour around a concealed range, the reveal policies, and
what happens when the syntax a rule matches is broken outside the editor.

## What pure configuration cannot reach

Walls this extension hit, in the order they were hit. The long version, with what each one costs and
what would fix it, is in the write-up that accompanies this repository.

1. **A computed replacement.** `replaceWith` can only reassemble what the pattern captured. Turning
   `abstractsingletonproxyfactorybean` into `aspfb`, a translation key into its translation, or a
   citation key into `(Smith, 2020)` all need a value from outside the text, and no amount of regex
   configuration produces one.
2. **The 16-character cap.** The editor cuts every replacement to 16 characters. A fence chip
   (`▸ #todo !#done · 20`) does not fit, and neither does masking a 40-character secret at its own
   width.
3. **One decoration type per string drawn.** The replacement is a property of the decoration
   *type*, so a rule with `$1` in it creates a type per distinct result. The count grows with the
   text, not with the configuration.
4. **Whole-line concealment.** Hiding the text of a line that exists only for its text leaves an
   empty line — and, with the default caret stop, a row with no line number in the gutter.
5. **Click-to-expand.** A concealed range has no width, so a click on the placeholder cannot be told
   from a click on the character beside it.

## Development

```bash
npm install
npm run compile          # types, lint, rule sync, bundle
npm run test:unit        # pure logic, no editor
npm test                 # integration, in an extension host
npm run vsix             # a .vsix in ./builds
```

`npm test` launches a stock VS Code by default, where it checks the half that has to work *without*
the API. Point it at a build that has the proposal to run the same suite where concealment is real:

```bash
CONCEAL_DEMO_VSCODE=/path/to/code npm test
```

`src/vscode.proposed.concealedText.d.ts` is a vendored copy of the fork's declaration —
`npx @vscode/dts dev` cannot fetch it, because the proposal is not in microsoft/vscode.

## Recording the demos

The recordings in `examples/` are not animations: `src/recorder.ts` drives a real editor from
inside it, stopping at every frame, and `scripts/record.sh` photographs the window. Each scene
names the one file it is about, and its GIF is written beside that file under the same name — so
[examples/README.md](examples/README.md) can link the file and show the picture without a path
being burnt into the frames.

```bash
CONCEAL_DEMO_FORK=/path/to/vscode-fork \
CONCEAL_DEMO_WINSHOT=/path/to/screenshot-helper.ps1 \
  ./scripts/record.sh              # every scene in examples/scenes.json
  ./scripts/record.sh 12 13        # only scenes whose id contains 12 or 13
```

It needs the conceal-capable fork (as `scripts/dev.sh` does), `ffmpeg`, and a screenshot helper
taking `-Hwnd`/`-Out` — this is a WSLg machine, where the editor window is a Win32 window like any
other and there is no Linux screenshot tool. Nothing is on a timer: the recorder writes a
rendezvous file when a state is ready and blocks until the picture has been taken, so no frame can
catch a half-applied decoration.
