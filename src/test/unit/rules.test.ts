import * as assert from "node:assert";
import { normalizeRule, normalizeRules } from "../../rules";

function asRule(raw: unknown) {
  const result = normalizeRule(raw, "user", 0);
  assert.ok(!("message" in result), `expected a rule, got ${JSON.stringify(result)}`);
  return result as Exclude<typeof result, { message: string }>;
}

function asProblem(raw: unknown) {
  const result = normalizeRule(raw, "user", 0);
  assert.ok("message" in result, `expected a problem, got ${JSON.stringify(result)}`);
  return result as { id: string; message: string };
}

suite("rules", () => {
  test("fills in every default", () => {
    const rule = asRule({ pattern: "x" });
    assert.strictEqual(rule.group, 0);
    assert.strictEqual(rule.replaceWith, "");
    assert.strictEqual(rule.cursorStop, "after");
    assert.strictEqual(rule.reveal, "never");
    assert.strictEqual(rule.padToWidth, false);
    assert.strictEqual(rule.padWith, " ");
    assert.strictEqual(rule.hover, false);
    assert.deepStrictEqual(rule.style, {});
    assert.strictEqual(rule.files, undefined);
  });

  test("always compiles with g and d, so a line can be walked and a group located", () => {
    const rule = asRule({ pattern: "(a)(b)", flags: "i" });
    assert.strictEqual(rule.regex.flags.includes("g"), true);
    assert.strictEqual(rule.regex.flags.includes("d"), true);
    assert.strictEqual(rule.regex.flags.includes("i"), true);
  });

  test("refuses flags that are meaningless line by line", () => {
    assert.match(asProblem({ pattern: "x", flags: "m" }).message, /not allowed/);
    assert.match(asProblem({ pattern: "x", flags: "s" }).message, /not allowed/);
    assert.match(asProblem({ pattern: "x", flags: "g" }).message, /always on/);
  });

  test("reports a bad pattern instead of throwing", () => {
    assert.match(asProblem({ pattern: "([" }).message, /invalid regular expression/);
  });

  test("checks the enums", () => {
    assert.match(asProblem({ pattern: "x", cursorStop: "middle" }).message, /cursorStop/);
    assert.match(asProblem({ pattern: "x", reveal: "sometimes" }).message, /reveal/);
    assert.match(asProblem({ pattern: "x", group: -1 }).message, /group/);
  });

  test("one broken rule does not cost the others", () => {
    const { rules, problems } = normalizeRules(
      [{ pattern: "good" }, { pattern: "([" }, { pattern: "also good" }],
      "example",
    );
    assert.strictEqual(rules.length, 2);
    assert.strictEqual(problems.length, 1);
  });

  test("skips disabled rules without calling them broken", () => {
    const { rules, problems } = normalizeRules([{ pattern: "x", enabled: false }], "user");
    assert.deepStrictEqual(rules, []);
    assert.deepStrictEqual(problems, []);
  });

  test("names an unnamed rule after its position", () => {
    assert.strictEqual(asRule({ pattern: "x" }).id, "user[0]");
  });
});
