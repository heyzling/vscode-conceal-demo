import * as assert from "node:assert";
import {
  MAX_REPLACEMENT_CHARACTERS,
  capReplacement,
  expandTemplate,
  padToWidth,
  resolveReplacement,
} from "../../replacement";

function match(pattern: string, text: string): RegExpExecArray {
  const found = new RegExp(pattern, "d").exec(text);
  assert.ok(found, `${pattern} did not match ${text}`);
  return found;
}

suite("replacement", () => {
  test("expands $&, $1 and $$", () => {
    const found = match("v(\\d+)", "v137");
    assert.strictEqual(expandTemplate("⌁$1", found), "⌁137");
    assert.strictEqual(expandTemplate("[$&]", found), "[v137]");
    assert.strictEqual(expandTemplate("$$1", found), "$1");
  });

  test("leaves a group reference that does not exist alone", () => {
    const found = match("(a)", "a");
    assert.strictEqual(expandTemplate("$9", found), "$9");
  });

  test("cuts to the editor's cap, counting characters and not code units", () => {
    const emoji = "✅".repeat(MAX_REPLACEMENT_CHARACTERS + 4);
    const capped = capReplacement(emoji);
    assert.strictEqual(capped.truncated, true);
    assert.strictEqual(Array.from(capped.text).length, MAX_REPLACEMENT_CHARACTERS);
    assert.strictEqual(capped.text.endsWith("✅"), true);
  });

  test("drops line feeds, because a replacement is drawn on one line", () => {
    assert.strictEqual(capReplacement("a\nb\r\nc").text, "abc");
  });

  test("pads with the fill character up to the hidden width", () => {
    assert.strictEqual(padToWidth("•", 6, "•"), "••••••");
    assert.strictEqual(padToWidth("x", 4, " "), "x   ");
    assert.strictEqual(padToWidth("already wide", 3, " "), "already wide");
  });

  test("reports when the cap made width preservation impossible", () => {
    const secret = "sk-live-2f9c8a7b6d5e4f3a2b1c0d9e8f7a6b5c";
    const found = match(".+", secret);
    const resolved = resolveReplacement("•", found, secret, true, "•");
    assert.strictEqual(resolved.truncated, true);
    assert.strictEqual(resolved.wantedWidth, secret.length);
    assert.strictEqual(Array.from(resolved.text).length, MAX_REPLACEMENT_CHARACTERS);
  });

  test("an empty template means hide, and is never padded or capped", () => {
    const found = match(".+", "whatever");
    assert.deepStrictEqual(resolveReplacement("", found, "whatever", true, "•"), {
      text: "",
      truncated: false,
    });
  });
});
