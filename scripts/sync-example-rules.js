/**
 * `examples/default-rules.json` is the readable copy of the rules this extension ships: it can be
 * pasted straight into a settings.json. The manifest needs the same array as the default value of
 * `conceal-demo.exampleRules`, so that the settings UI shows it and `getConfiguration().get()`
 * returns it with no code behind it.
 *
 * One source of truth, copied here rather than duplicated by hand. `npm run check-example-rules`
 * fails when the two drift, and the unit tests check the same thing.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const RULES_FILE = path.join(ROOT, "examples", "default-rules.json");
const MANIFEST = path.join(ROOT, "package.json");
const SETTING = "conceal-demo.exampleRules";

function readRules() {
  const document = JSON.parse(fs.readFileSync(RULES_FILE, "utf8"));
  const rules = document[SETTING];
  if (!Array.isArray(rules)) {
    throw new Error(`${RULES_FILE} must hold a "${SETTING}" array`);
  }
  return rules;
}

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
}

function manifestDefault(manifest) {
  return manifest.contributes.configuration.properties[SETTING].default;
}

const check = process.argv.includes("--check");
const rules = readRules();
const manifest = readManifest();

if (JSON.stringify(manifestDefault(manifest)) === JSON.stringify(rules)) {
  console.log(`${SETTING}: in sync (${rules.length} rules)`);
  process.exit(0);
}

if (check) {
  console.error(
    `${SETTING} in package.json differs from examples/default-rules.json — run \`npm run sync-example-rules\``,
  );
  process.exit(1);
}

manifest.contributes.configuration.properties[SETTING].default = rules;
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${SETTING}: updated package.json from examples/default-rules.json (${rules.length} rules)`);
