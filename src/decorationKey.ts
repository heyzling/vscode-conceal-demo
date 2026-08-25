/**
 * Which decoration type a span needs.
 *
 * The conceal API carries `replacement` and `cursorStop` on the decoration *type*, not on the
 * range, so every distinct pair of (what is drawn, how it is drawn) is a separate
 * `TextEditorDecorationType`. Spans are therefore pooled by exactly the properties that reach the
 * type — which is also what makes the cost of per-occurrence replacement measurable: see
 * `conceal-demo.showStats`.
 */

import { CursorStop, RuleStyle } from "./rules";

export interface DecorationSpec {
  replacement: string;
  cursorStop: CursorStop;
  style: RuleStyle;
}

/** A stable string for a spec: same spec, same key, whatever order the style was written in. */
export function decorationKey(spec: DecorationSpec): string {
  const style = Object.keys(spec.style)
    .sort()
    .map((key) => `${key}=${spec.style[key as keyof RuleStyle]}`)
    .join(";");
  // cursorStop is only read for a fully hidden range, but it still reaches the type, so two rules
  // differing only in it cannot share one.
  return JSON.stringify([spec.replacement, spec.cursorStop, style]);
}
