import * as fs from "node:fs";
import * as path from "node:path";
import Mocha from "mocha";

/**
 * The mocha entry point an extension host runs when it is given `--extensionTestsPath`.
 *
 * `npm test` drives the same suite through `@vscode/test-cli`, which builds its own runner; this
 * one exists so the suite can also be pointed at a VS Code that is being **run from sources**,
 * where the executable has to be launched by the checkout's own `scripts/code.sh` and there is
 * nothing for `useInstallation` to install. See `scripts/test-fork.sh`.
 */
export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: "tdd", color: true, timeout: 20000, grep: process.env.CONCEAL_DEMO_GREP });
  const testsRoot = path.resolve(__dirname, "../integration");
  for (const file of fs.readdirSync(testsRoot).sort()) {
    if (file.endsWith(".test.js")) {
      mocha.addFile(path.join(testsRoot, file));
    }
  }
  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} test(s) failed.`));
      } else {
        resolve();
      }
    });
  });
}
