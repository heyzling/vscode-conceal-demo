import { describe } from "./concealApi";
import { EngineStats } from "./engine";

/** The text `conceal-demo.showStats` prints.
 *
 * The numbers worth reading are the two the API's shape produces: `decoration types created`,
 * which grows with the *text* whenever a replacement contains a capture-group reference, and
 * `replacements truncated`, which counts the times the editor's 16-character cap cut something. */
export function renderStats(stats: EngineStats): string {
  const lines: string[] = [];
  lines.push("Conceal Demo — statistics");
  lines.push("");
  lines.push(`conceal API:      ${describe(stats.availability)}`);
  lines.push(`concealment:      ${stats.enabled ? "on" : "off (conceal-demo.enabled)"}`);
  lines.push(`rules:            ${stats.userRules} user, ${stats.exampleRules} example`);
  if (stats.problems.length > 0) {
    lines.push(`rejected rules:   ${stats.problems.length}`);
    for (const problem of stats.problems) {
      lines.push(`  - ${problem.id}: ${problem.message}`);
    }
  }
  lines.push("");
  lines.push("decoration types (one per distinct replacement + style, because the conceal API");
  lines.push("carries the replacement on the type and not on the range):");
  lines.push(`  live:           ${stats.pool.live}`);
  lines.push(`  created total:  ${stats.pool.createdTotal}`);
  lines.push(`  peak live:      ${stats.pool.peak}`);
  lines.push("");
  if (stats.documents.length === 0) {
    lines.push("no documents seen yet");
    return lines.join("\n");
  }
  lines.push("documents:");
  for (const document of stats.documents) {
    lines.push(`  ${document.uri}`);
    if (!document.included) {
      lines.push("    not in conceal-demo.include — nothing applied");
      continue;
    }
    if (!document.concealEnabled) {
      lines.push("    editor.concealedText is off for this document's language — nothing applied");
      continue;
    }
    if (document.rulesApplied.length === 0 && document.spans === 0) {
      lines.push("    in scope, but no rule ran (concealment off, or no rule matches this file)");
      continue;
    }
    lines.push(
      `    ${document.spans} span(s), ${document.decorationTypes} type(s), ${document.revealed} revealed, ${document.elapsedMs}ms`,
    );
    if (document.truncated > 0) {
      lines.push(`    ${document.truncated} replacement(s) cut to 16 characters by the editor`);
    }
    if (document.padFailed > 0) {
      lines.push(
        `    ${document.padFailed} replacement(s) could not be padded to the hidden text's width — the cap is shorter than the text`,
      );
    }
    if (document.budgetExhausted) {
      lines.push("    hit conceal-demo.maxMatchesPerFile; the rest of the file is not concealed");
    }
    if (document.rulesApplied.length > 0) {
      lines.push(`    rules: ${document.rulesApplied.join(", ")}`);
    }
  }
  return lines.join("\n");
}
