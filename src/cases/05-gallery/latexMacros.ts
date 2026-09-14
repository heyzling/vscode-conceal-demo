/**
 * `\alpha` drawn as α, and so on from a table. The glyph says what the macro is, so the delete
 * keys edit the macro's real characters one at a time: Backspace on α leaves `\alph` in view.
 */

import * as vscode from "vscode";
import type { Example } from "./example";

const GLYPH: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  pi: "π",
  sum: "∑",
  infty: "∞",
  leq: "≤",
  geq: "≥",
  times: "×",
};

const macro = vscode.window.createTextEditorDecorationType({
  conceal: { deletionPolicy: "passthrough" },
});

export const examples: Example[] = [
  {
    file: "formula.tex",
    pattern: new RegExp(`\\\\(${Object.keys(GLYPH).join("|")})\\b`, "g"),
    decoration: macro,
    replacement: (match) => GLYPH[match[1]],
  },
];
