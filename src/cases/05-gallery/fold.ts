/**
 * Long attribute values folded to a `•••` chip. The chip predicts nothing about the value, so a
 * delete key beside it shows the value and takes nothing; the caret leaving folds it again.
 */

import * as vscode from "vscode";
import type { Example } from "./example";

const fold = vscode.window.createTextEditorDecorationType({
  conceal: {
    deletionPolicy: "reveal",
    replacement: {
      contentText: "•••",
      fontWeight: "bold",
      color: new vscode.ThemeColor("editor.foreground"),
      backgroundColor: new vscode.ThemeColor("editorInlayHint.background"),
      borderRadius: "3px",
      padding: "0 3px",
    },
  },
});

export const examples: Example[] = [
  // A `class` value longer than 30 characters, quotes excluded.
  { file: "card.html", pattern: /(?<=class=")[^"]{31,}(?=")/g, decoration: fold },
];
