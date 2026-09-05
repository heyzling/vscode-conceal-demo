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
