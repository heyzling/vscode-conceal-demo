/**
 * `\alpha` drawn as α, and so on from a table. Backspace on α shows `\alpha` and takes nothing;
 * the next press edits the macro's real characters.
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
  conceal: { deletionPolicy: vscode.ConcealDeletionPolicy.Reveal },
});

export const examples: Example[] = [
  {
    file: "formula.tex",
    pattern: new RegExp(`\\\\(${Object.keys(GLYPH).join("|")})\\b`, "g"),
    decoration: macro,
    replacement: (match) => GLYPH[match[1]],
  },
];
