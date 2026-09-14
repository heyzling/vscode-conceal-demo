/**
 * `fun` drawn as λ and `->` as →, the moment they are typed.
 */

import * as vscode from "vscode";
import type { Example } from "./example";

const GLYPH: Record<string, string> = { fun: "λ", "->": "→" };

const symbol = vscode.window.createTextEditorDecorationType({ conceal: {} });

export const examples: Example[] = [
  { file: "lambda.fs", pattern: /\bfun\b|->/g, decoration: symbol, replacement: (match) => GLYPH[match[0]] },
];
