import { defineConfig } from "@vscode/test-cli";

/**
 * Integration tests run against whatever build `vscode-test` is pointed at.
 *
 * Against a stock VS Code — the default — they cover the half of this extension that has to work
 * without the conceal API: rules are parsed, the API is reported as unavailable, and nothing is
 * concealed. Point `CONCEAL_DEMO_VSCODE` at a build carrying the `concealedText` proposal to run
 * the same suite where concealment is real.
 */
export default defineConfig({
  files: "out/test/**/*.test.js",
  version: process.env.CONCEAL_DEMO_VSCODE ? undefined : "stable",
  useInstallation: process.env.CONCEAL_DEMO_VSCODE
    ? { fromPath: process.env.CONCEAL_DEMO_VSCODE }
    : undefined,
  workspaceFolder: "./examples",
  launchArgs: ["--enable-proposed-api", "heyzling.conceal-demo"],
  mocha: {
    ui: "tdd",
    timeout: 20000,
  },
});
