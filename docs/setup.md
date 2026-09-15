# Setup


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

## Commands

- **Conceal Demo: Toggle Concealment**

## Development

```bash
npm install
npm run compile          # types, lint, bundle
npm test                 # integration, in a stock extension host
npm run test:fork        # the same suite in the fork, run from sources
npm run vsix             # a .vsix in ./builds
```

`npm test` launches a stock VS Code by default, where it checks the half that has to work *without*
the API. Point it at a build that has the proposal to run the same suite where concealment is real:

```bash
CONCEAL_DEMO_VSCODE=/path/to/code npm test
CONCEAL_DEMO_FORK=/path/to/vscode-fork npm run test:fork
```

Every scene in `examples/scenes.jsonc` is also an end-to-end test: `src/test/integration/scenes.test.ts`
plays it through the recorder with nothing photographed and checks each step's `expect` — the
caret, the selection, the lines it names, the text pasted beside — against what the GIF shows.
What is drawn cannot be seen from an extension, so a `press` probe stands in for it: a cursor
command pressed at a position and where the caret lands. One → crossing a range whole is the
model's own proof that the range is concealed; a step of one character, that it is not.
The window needs no focus: steps are commands, not keystrokes.
`CONCEAL_DEMO_TRACE=1` prints every frame's carets and their lines, which is what a new scene's
`expect` is written from.

`src/vscode.proposed.concealedText.d.ts` is a vendored copy of the fork's declaration —
`npx @vscode/dts dev` cannot fetch it, because the proposal is not in microsoft/vscode.
