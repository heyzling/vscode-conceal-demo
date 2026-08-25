import * as assert from "node:assert";
import { decorationKey } from "../../decorationKey";

suite("decorationKey", () => {
  test("the same spec is the same key whatever order the style was written in", () => {
    const a = decorationKey({
      replacement: "…",
      cursorStop: "after",
      style: { color: "red", margin: "0 1px" },
    });
    const b = decorationKey({
      replacement: "…",
      cursorStop: "after",
      style: { margin: "0 1px", color: "red" },
    });
    assert.strictEqual(a, b);
  });

  test("a different replacement is a different decoration type — this is the cost the API imposes", () => {
    const ten = decorationKey({ replacement: "⌁10", cursorStop: "after", style: {} });
    const seven = decorationKey({ replacement: "⌁7", cursorStop: "after", style: {} });
    assert.notStrictEqual(ten, seven);
  });

  test("cursorStop reaches the type, so two rules differing only in it cannot share one", () => {
    const before = decorationKey({ replacement: "", cursorStop: "before", style: {} });
    const after = decorationKey({ replacement: "", cursorStop: "after", style: {} });
    assert.notStrictEqual(before, after);
  });
});
