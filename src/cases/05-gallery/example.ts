/**
 * What every gallery example is: one regular expression, one decoration type, one example file.
 */

import * as vscode from "vscode";

export interface Example {
  /** The example file's name under `examples/05-gallery`. */
  file: string;
  pattern: RegExp;
  decoration: vscode.TextEditorDecorationType;
  /** What a match draws. Nothing is drawn when absent. */
  replacement?: (match: RegExpExecArray) => string;
}

/** Every match of the example's pattern in `document`, line by line, as the decoration's ranges. */
export function decorations(document: vscode.TextDocument, example: Example): vscode.DecorationOptions[] {
  const found: vscode.DecorationOptions[] = [];
  for (let line = 0; line < document.lineCount; line += 1) {
    const text = document.lineAt(line).text;
    example.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = example.pattern.exec(text)) !== null) {
      const range = new vscode.Range(line, match.index, line, match.index + match[0].length);
      found.push(
        example.replacement
          ? { range, renderOptions: { conceal: { replacement: { contentText: example.replacement(match) } } } }
          : { range },
      );
    }
  }
  return found;
}
