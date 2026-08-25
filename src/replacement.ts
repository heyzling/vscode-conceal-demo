/**
 * Turning a rule's `replaceWith` into the string the editor is asked to draw.
 *
 * Two properties of the API are reproduced here rather than discovered at runtime, because the
 * editor applies them silently: a replacement is drawn on one line, so line feeds are dropped, and
 * it is cut to {@link MAX_REPLACEMENT_CHARACTERS} characters. Knowing locally that a cut happened
 * is the only way this extension can report it.
 */

/** The cap the conceal API applies to `replacement.contentText`, counted in characters rather than
 * in UTF-16 code units so a surrogate pair is never halved.
 *
 * Kept in step with `MAX_REPLACEMENT_CHARACTERS` in the editor's `ConcealRenderOptions.from`. */
export const MAX_REPLACEMENT_CHARACTERS = 16;

/** Expands `$&`, `$1`..`$99` and `$$` against a match. `$0` is not special (`String.replace` does
 * not treat it as the whole match either), and a group that did not participate expands to "". */
export function expandTemplate(template: string, match: RegExpExecArray): string {
  return template.replace(/\$(\$|&|\d{1,2})/g, (whole, token: string) => {
    if (token === "$") {
      return "$";
    }
    if (token === "&") {
      return match[0];
    }
    const index = Number(token);
    if (index === 0 || index >= match.length) {
      return whole;
    }
    return match[index] ?? "";
  });
}

export interface CappedReplacement {
  text: string;
  /** True when the editor would have cut this replacement, i.e. this extension already did. */
  truncated: boolean;
}

/** Applies the editor's own rules to a replacement, so what is reported is what is drawn. */
export function capReplacement(text: string): CappedReplacement {
  const oneLine = text.replace(/[\r\n]/g, "");
  const characters = Array.from(oneLine);
  if (characters.length <= MAX_REPLACEMENT_CHARACTERS) {
    return { text: oneLine, truncated: false };
  }
  return { text: characters.slice(0, MAX_REPLACEMENT_CHARACTERS).join(""), truncated: true };
}

/** Pads a replacement out to the width of the text it stands for, so nothing after it moves.
 *
 * "Width" is counted in characters, which is what a monospace font agrees with for the cases here
 * and disagrees with for wide glyphs and combining marks — this is a demo of a limit, not a
 * text-shaping engine. */
export function padToWidth(text: string, hiddenWidth: number, fill: string): string {
  const width = Array.from(text).length;
  if (width >= hiddenWidth || fill.length === 0) {
    return text;
  }
  const filler = Array.from(fill);
  const missing = hiddenWidth - width;
  let padded = text;
  for (let i = 0; i < missing; i += 1) {
    padded += filler[i % filler.length];
  }
  return padded;
}

export interface ResolvedReplacement extends CappedReplacement {
  /** The width the caller asked for, when padding was requested and the cap prevented it. */
  wantedWidth?: number;
}

/** The whole pipeline for one match: template → padding → the editor's cap. */
export function resolveReplacement(
  template: string,
  match: RegExpExecArray,
  hiddenText: string,
  pad: boolean,
  padWith: string,
): ResolvedReplacement {
  if (template === "") {
    return { text: "", truncated: false };
  }
  const expanded = expandTemplate(template, match);
  const hiddenWidth = Array.from(hiddenText).length;
  const padded = pad ? padToWidth(expanded, hiddenWidth, padWith) : expanded;
  const capped = capReplacement(padded);
  if (pad && capped.truncated) {
    return { ...capped, wantedWidth: hiddenWidth };
  }
  return capped;
}
