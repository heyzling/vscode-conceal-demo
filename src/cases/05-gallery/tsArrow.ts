/**
 * `=>` drawn as one ⇒.
 */

import * as vscode from "vscode";
import type { Example } from "./example";

const arrow = vscode.window.createTextEditorDecorationType({
  conceal: { replacement: { contentText: "⇒" } },
});

export const examples: Example[] = [{ file: "arrow.ts", pattern: /=>/g, decoration: arrow }];
