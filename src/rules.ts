/**
 * The rule shape the whole extension is configured with, and the checking that turns whatever is
 * in settings.json into something safe to run. Deliberately free of `vscode` imports so it can be
 * unit-tested in plain node.
 */

export type CursorStop = "before" | "after";
export type RevealPolicy = "never" | "adjacent" | "line" | "selection";
export type RuleSource = "user" | "example";

/** How a replacement is drawn. A subset of ThemableDecorationAttachmentRenderOptions — the fields
 * that survive being written by hand in a settings file. */
export interface RuleStyle {
  color?: string;
  backgroundColor?: string;
  border?: string;
  borderRadius?: string;
  fontStyle?: string;
  fontWeight?: string;
  textDecoration?: string;
  margin?: string;
  width?: string;
  height?: string;
}

const STYLE_KEYS: readonly (keyof RuleStyle)[] = [
  "color",
  "backgroundColor",
  "border",
  "borderRadius",
  "fontStyle",
  "fontWeight",
  "textDecoration",
  "margin",
  "width",
  "height",
];

/** A rule exactly as it appears in settings.json. Every field but `pattern` is optional. */
export interface RawRule {
  id?: string;
  enabled?: boolean;
  pattern: string;
  flags?: string;
  group?: number;
  files?: string[];
  languages?: string[];
  replaceWith?: string;
  cursorStop?: CursorStop;
  padToWidth?: boolean;
  padWith?: string;
  hover?: boolean;
  reveal?: RevealPolicy;
  style?: RuleStyle;
}

/** A rule that has been checked and is ready to run. */
export interface Rule {
  id: string;
  source: RuleSource;
  /** Compiled with `g` and `d`: `g` to walk a line, `d` to know where a capture group sat. */
  regex: RegExp;
  group: number;
  files: string[] | undefined;
  languages: string[] | undefined;
  replaceWith: string;
  cursorStop: CursorStop;
  padToWidth: boolean;
  padWith: string;
  hover: boolean;
  reveal: RevealPolicy;
  style: RuleStyle;
}

export interface RuleProblem {
  id: string;
  message: string;
}

export interface NormalizedRules {
  rules: Rule[];
  problems: RuleProblem[];
}

/** `g` and `d` are added by us; matching happens one line at a time, so `m`, `s` and `y` are
 * either meaningless or actively wrong here and are refused rather than silently dropped. */
const ADDED_FLAGS = "gd";
const ALLOWED_EXTRA_FLAGS = "iuv";

const CURSOR_STOPS: readonly string[] = ["before", "after"];
const REVEALS: readonly string[] = ["never", "adjacent", "line", "selection"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const strings = value.filter((item): item is string => typeof item === "string");
  return strings.length > 0 ? strings : undefined;
}

function readStyle(value: unknown): RuleStyle {
  if (!isRecord(value)) {
    return {};
  }
  const style: RuleStyle = {};
  for (const key of STYLE_KEYS) {
    const item = value[key];
    if (typeof item === "string" && item.length > 0) {
      style[key] = item;
    }
  }
  return style;
}

/** Turns one settings entry into a runnable rule, or says why it cannot. */
export function normalizeRule(raw: unknown, source: RuleSource, index: number): Rule | RuleProblem {
  const fallbackId = `${source}[${index}]`;
  if (!isRecord(raw)) {
    return { id: fallbackId, message: "not an object" };
  }
  const id = typeof raw.id === "string" && raw.id.length > 0 ? raw.id : fallbackId;

  if (typeof raw.pattern !== "string" || raw.pattern.length === 0) {
    return { id, message: "`pattern` is required and must be a non-empty string" };
  }

  const extraFlags = typeof raw.flags === "string" ? raw.flags : "";
  for (const flag of extraFlags) {
    if (ADDED_FLAGS.includes(flag)) {
      return { id, message: `flag '${flag}' is always on and cannot be given` };
    }
    if (!ALLOWED_EXTRA_FLAGS.includes(flag)) {
      return {
        id,
        message: `flag '${flag}' is not allowed — rules are matched one line at a time, so only ${[...ALLOWED_EXTRA_FLAGS].join(", ")} make sense`,
      };
    }
  }

  let regex: RegExp;
  try {
    regex = new RegExp(raw.pattern, ADDED_FLAGS + extraFlags);
  } catch (error) {
    return { id, message: `invalid regular expression: ${(error as Error).message}` };
  }

  const group = raw.group === undefined ? 0 : raw.group;
  if (typeof group !== "number" || !Number.isInteger(group) || group < 0) {
    return { id, message: "`group` must be a non-negative integer" };
  }

  const cursorStop = raw.cursorStop === undefined ? "after" : raw.cursorStop;
  if (typeof cursorStop !== "string" || !CURSOR_STOPS.includes(cursorStop)) {
    return { id, message: "`cursorStop` must be \"before\" or \"after\"" };
  }

  const reveal = raw.reveal === undefined ? "never" : raw.reveal;
  if (typeof reveal !== "string" || !REVEALS.includes(reveal)) {
    return { id, message: `\`reveal\` must be one of ${REVEALS.join(", ")}` };
  }

  const replaceWith = typeof raw.replaceWith === "string" ? raw.replaceWith : "";

  return {
    id,
    source,
    regex,
    group,
    files: stringArray(raw.files),
    languages: stringArray(raw.languages),
    replaceWith,
    cursorStop: cursorStop as CursorStop,
    padToWidth: raw.padToWidth === true,
    padWith: typeof raw.padWith === "string" && raw.padWith.length > 0 ? raw.padWith : " ",
    hover: raw.hover === true,
    reveal: reveal as RevealPolicy,
    style: readStyle(raw.style),
  };
}

function isProblem(value: Rule | RuleProblem): value is RuleProblem {
  return (value as RuleProblem).message !== undefined;
}

/** Normalizes a whole settings array, keeping the good rules and collecting the rest as problems.
 * One broken rule never costs the others: a regex typo should show up in the log, not take the
 * extension down. */
export function normalizeRules(raw: unknown, source: RuleSource): NormalizedRules {
  if (raw === undefined || raw === null) {
    return { rules: [], problems: [] };
  }
  if (!Array.isArray(raw)) {
    return { rules: [], problems: [{ id: source, message: "must be an array of rules" }] };
  }
  const rules: Rule[] = [];
  const problems: RuleProblem[] = [];
  raw.forEach((entry, index) => {
    if (isRecord(entry) && entry.enabled === false) {
      return;
    }
    const result = normalizeRule(entry, source, index);
    if (isProblem(result)) {
      problems.push(result);
    } else {
      rules.push(result);
    }
  });
  return { rules, problems };
}
