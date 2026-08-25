import * as assert from "node:assert";
import { MatchBudget, spansForLines, spansForRuleOnLine } from "../../matcher";
import { Rule, normalizeRule } from "../../rules";

function rule(raw: Record<string, unknown>): Rule {
  const result = normalizeRule(raw, "user", 0);
  assert.ok(!("message" in result), JSON.stringify(result));
  return result as Rule;
}

function budget(remaining = 100): MatchBudget {
  return { remaining, exhausted: false };
}

suite("matcher", () => {
  test("finds every occurrence on a line", () => {
    const spans = spansForRuleOnLine(rule({ pattern: "\\*\\*" }), "**a** and **b**", 0, budget());
    assert.deepStrictEqual(
      spans.map((span) => [span.start, span.end]),
      [
        [0, 2],
        [3, 5],
        [10, 12],
        [13, 15],
      ],
    );
  });

  test("conceals only the requested capture group", () => {
    const spans = spansForRuleOnLine(
      rule({ pattern: '(?<=class=")([\\w-]+) ([^"]+)(?=")', group: 2 }),
      '<div class="card flex items-center">',
      0,
      budget(),
    );
    assert.strictEqual(spans.length, 1);
    assert.strictEqual(spans[0].hidden, "flex items-center");
  });

  test("ignores a group that did not participate", () => {
    const spans = spansForRuleOnLine(rule({ pattern: "a(b)?", group: 1 }), "a a a", 0, budget());
    assert.deepStrictEqual(spans, []);
  });

  test("skips zero-length matches instead of looping forever", () => {
    const spans = spansForRuleOnLine(rule({ pattern: "x*" }), "abc", 0, budget());
    assert.deepStrictEqual(spans, []);
  });

  test("first rule wins an overlap", () => {
    const spans = spansForLines(
      [rule({ id: "first", pattern: "abc" }), rule({ id: "second", pattern: "bcd" })],
      ["abcd"],
      budget(),
    );
    assert.deepStrictEqual(
      spans.map((span) => span.rule.id),
      ["first"],
    );
  });

  test("stops at the budget and says so", () => {
    const limit = budget(3);
    const spans = spansForLines([rule({ pattern: "a" })], ["aaaa", "aaaa"], limit);
    assert.strictEqual(spans.length, 3);
    assert.strictEqual(limit.exhausted, true);
  });

  test("returns spans in document order", () => {
    const spans = spansForLines(
      [rule({ id: "late", pattern: "z" }), rule({ id: "early", pattern: "a" })],
      ["a z"],
      budget(),
    );
    assert.deepStrictEqual(
      spans.map((span) => span.start),
      [0, 2],
    );
  });
});
