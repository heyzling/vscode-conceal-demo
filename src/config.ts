import * as vscode from "vscode";
import { RawRule } from "./rules";

export const SECTION = "conceal-demo";

export interface Settings {
  enabled: boolean;
  include: string[];
  disableExamples: boolean;
  rules: RawRule[];
  exampleRules: RawRule[];
  maxMatchesPerFile: number;
  trace: boolean;
}

export function readSettings(): Settings {
  const config = vscode.workspace.getConfiguration(SECTION);
  return {
    enabled: config.get<boolean>("enabled", true),
    include: config.get<string[]>("include", []),
    disableExamples: config.get<boolean>("disableExamples", false),
    rules: config.get<RawRule[]>("rules", []),
    exampleRules: config.get<RawRule[]>("exampleRules", []),
    maxMatchesPerFile: config.get<number>("maxMatchesPerFile", 2000),
    trace: config.get<boolean>("trace", false),
  };
}

export function affectsSettings(event: vscode.ConfigurationChangeEvent): boolean {
  return event.affectsConfiguration(SECTION) || event.affectsConfiguration("editor.concealedText");
}

/** Whether a document is inside the blast radius the user allowed.
 *
 * `vscode.languages.match` is the editor's own glob matcher, which saves a dependency and gets
 * `RelativePattern`-free string globs matched against the document's path the same way every other
 * `DocumentSelector` is. */
export function matchesGlobs(document: vscode.TextDocument, globs: string[]): boolean {
  return globs.some((pattern) => vscode.languages.match({ pattern }, document) > 0);
}

export function matchesLanguages(document: vscode.TextDocument, languages: string[]): boolean {
  return languages.includes(document.languageId);
}
