/**
 * Running rules over text. Pure: it knows about lines and character offsets, not about documents.
 */

import { resolveReplacement } from "./replacement";
import { Rule } from "./rules";

export interface ConcealSpan {
  rule: Rule;
  line: number;
  /** Character offsets within the line. */
  start: number;
  end: number;
  /** What the file says here — the text that leaves the view. */
  hidden: string;
  /** What is drawn in its place, after template expansion, padding and the editor's cap. */
  replacement: string;
  /** The replacement was longer than the editor will draw. */
  truncated: boolean;
  /** Padding to the hidden text's width was asked for and the cap made it impossible. */
  padFailedWidth?: number;
}

export interface MatchBudget {
  /** How many more spans may be produced before matching stops. */
  remaining: number;
  /** Set once the budget ran out, so the caller can say so. */
  exhausted: boolean;
}

/** Every span one rule produces on one line.
 *
 * Zero-length matches are skipped rather than concealed: a range that covers no characters hides
 * nothing and would still cost a decoration. `lastIndex` is advanced past them by hand, because a
 * `g` regex that matches empty otherwise never terminates. */
export function spansForRuleOnLine(
  rule: Rule,
  lineText: string,
  line: number,
  budget: MatchBudget,
): ConcealSpan[] {
  const spans: ConcealSpan[] = [];
  rule.regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = rule.regex.exec(lineText)) !== null) {
    if (match[0].length === 0) {
      rule.regex.lastIndex += 1;
      continue;
    }
    if (budget.remaining <= 0) {
      budget.exhausted = true;
      break;
    }
    const indices = match.indices?.[rule.group];
    if (indices) {
      const [start, end] = indices;
      if (end > start) {
        const hidden = lineText.slice(start, end);
        const replacement = resolveReplacement(
          rule.replaceWith,
          match,
          hidden,
          rule.padToWidth,
          rule.padWith,
        );
        budget.remaining -= 1;
        spans.push({
          rule,
          line,
          start,
          end,
          hidden,
          replacement: replacement.text,
          truncated: replacement.truncated,
          ...(replacement.wantedWidth === undefined ? {} : { padFailedWidth: replacement.wantedWidth }),
        });
      }
    }
  }
  return spans;
}

/** Every span every rule produces over a whole document, in document order.
 *
 * Overlaps are resolved first-rule-wins: two decorations concealing the same characters is a
 * question the API has no answer for, and the editor is not the place to find out. */
export function spansForLines(rules: Rule[], lines: string[], budget: MatchBudget): ConcealSpan[] {
  const result: ConcealSpan[] = [];
  for (let line = 0; line < lines.length; line += 1) {
    const text = lines[line];
    const taken: ConcealSpan[] = [];
    for (const rule of rules) {
      for (const span of spansForRuleOnLine(rule, text, line, budget)) {
        if (!taken.some((other) => span.start < other.end && other.start < span.end)) {
          taken.push(span);
        }
      }
      if (budget.exhausted) {
        break;
      }
    }
    taken.sort((a, b) => a.start - b.start);
    result.push(...taken);
    if (budget.exhausted) {
      break;
    }
  }
  return result;
}
