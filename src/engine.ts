import * as vscode from "vscode";
import { ConcealAvailability, concealEnabledFor, isAvailable } from "./concealApi";
import { Settings, matchesGlobs, matchesLanguages, readSettings } from "./config";
import { DecorationPool, PoolStats } from "./decorationPool";
import { ConcealSpan, MatchBudget, spansForLines } from "./matcher";
import { log } from "./log";
import { NormalizedRules, Rule, RuleProblem, normalizeRules } from "./rules";

/** What the last pass over one document did, for `conceal-demo.showStats`. */
export interface DocumentStats {
  uri: string;
  included: boolean;
  /** `editor.concealedText` as it resolves for this document's language. */
  concealEnabled: boolean;
  rulesApplied: string[];
  spans: number;
  revealed: number;
  decorationTypes: number;
  truncated: number;
  padFailed: number;
  budgetExhausted: boolean;
  elapsedMs: number;
}

export interface EngineStats {
  availability: ConcealAvailability;
  enabled: boolean;
  userRules: number;
  exampleRules: number;
  problems: RuleProblem[];
  pool: PoolStats;
  documents: DocumentStats[];
}

const REFRESH_DEBOUNCE_MS = 120;

/** Whether a span is currently revealed, i.e. concealment is dropped for it because of where the
 * caret or the selection is.
 *
 * Every policy other than `never` costs a reflow at the moment the caret arrives — the complaint
 * vim's `concealcursor` collects. It is here so that cost can be felt rather than argued about. */
function isRevealed(span: ConcealSpan, selections: readonly vscode.Selection[]): boolean {
  switch (span.rule.reveal) {
    case "never":
      return false;
    case "line":
      return selections.some(
        (selection) => selection.start.line <= span.line && span.line <= selection.end.line,
      );
    case "adjacent":
      return selections.some(
        (selection) =>
          selection.active.line === span.line &&
          selection.active.character >= span.start &&
          selection.active.character <= span.end,
      );
    case "selection":
      return selections.some((selection) => {
        if (selection.isEmpty) {
          return false;
        }
        const range = new vscode.Range(span.line, span.start, span.line, span.end);
        return selection.intersection(range) !== undefined;
      });
  }
}

/**
 * Owns the rules, the decoration pool and when either is applied to an editor.
 */
export class ConcealEngine implements vscode.Disposable {
  private readonly pool = new DecorationPool();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly timers = new Map<string, NodeJS.Timeout>();
  /** Decoration keys last applied to a document, so a pass only has to clear what it used. */
  private readonly applied = new Map<string, Set<string>>();
  private readonly documentStats = new Map<string, DocumentStats>();

  private settings: Settings = readSettings();
  private user: NormalizedRules = { rules: [], problems: [] };
  private examples: NormalizedRules = { rules: [], problems: [] };
  private rules: Rule[] = [];
  private watchesSelection = false;

  constructor(private availability: ConcealAvailability) {
    this.reload();
    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors(() => this.refreshAll()),
      vscode.workspace.onDidChangeTextDocument((event) => this.schedule(event.document)),
      vscode.workspace.onDidCloseTextDocument((document) => this.forget(document)),
    );
  }

  /** Re-reads settings and rebuilds the rule set. Cheap enough to do on every settings change. */
  reload(): void {
    this.settings = readSettings();
    this.user = normalizeRules(this.settings.rules, "user");
    this.examples = this.settings.disableExamples
      ? { rules: [], problems: [] }
      : normalizeRules(this.settings.exampleRules, "example");
    this.rules = [...this.user.rules, ...this.examples.rules];

    for (const problem of [...this.user.problems, ...this.examples.problems]) {
      log.error(`rule ${problem.id}: ${problem.message}`);
    }
    log.info(
      `${this.rules.length} rule(s) active (${this.user.rules.length} user, ${this.examples.rules.length} example)` +
        `; include: ${this.settings.include.join(", ") || "(nothing)"}`,
    );

    const wantsSelection = this.rules.some((rule) => rule.reveal !== "never");
    if (wantsSelection && !this.watchesSelection) {
      this.watchesSelection = true;
      this.disposables.push(
        vscode.window.onDidChangeTextEditorSelection((event) => this.refreshEditor(event.textEditor)),
      );
    }
    this.refreshAll();
  }

  setAvailability(availability: ConcealAvailability): void {
    this.availability = availability;
    this.refreshAll();
  }

  refreshAll(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.refreshEditor(editor);
    }
  }

  private schedule(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    const existing = this.timers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        for (const editor of vscode.window.visibleTextEditors) {
          if (editor.document.uri.toString() === key) {
            this.refreshEditor(editor);
          }
        }
      }, REFRESH_DEBOUNCE_MS),
    );
  }

  private forget(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    this.applied.delete(key);
    this.documentStats.delete(key);
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  private rulesFor(document: vscode.TextDocument): Rule[] {
    return this.rules.filter((rule) => {
      if (rule.files && !matchesGlobs(document, rule.files)) {
        return false;
      }
      if (rule.languages && !matchesLanguages(document, rule.languages)) {
        return false;
      }
      return true;
    });
  }

  refreshEditor(editor: vscode.TextEditor): void {
    const started = Date.now();
    const document = editor.document;
    const key = document.uri.toString();

    // Scope and power are separate answers: a file can be perfectly in scope while the engine is
    // off, and `conceal-demo.showStats` is only useful if it can tell the two apart.
    const included = matchesGlobs(document, this.settings.include);
    const concealEnabled = concealEnabledFor(document);
    const off = !this.settings.enabled || !isAvailable(this.availability) || !concealEnabled;
    const rules = included && !off ? this.rulesFor(document) : [];

    if (rules.length === 0) {
      this.clear(editor);
      this.documentStats.set(key, {
        uri: key,
        included,
        concealEnabled,
        rulesApplied: [],
        spans: 0,
        revealed: 0,
        decorationTypes: 0,
        truncated: 0,
        padFailed: 0,
        budgetExhausted: false,
        elapsedMs: Date.now() - started,
      });
      return;
    }

    const budget: MatchBudget = { remaining: this.settings.maxMatchesPerFile, exhausted: false };
    const lines = document.getText().split(/\r\n|\r|\n/);
    const spans = spansForLines(rules, lines, budget);

    const byKey = new Map<string, vscode.DecorationOptions[]>();
    let revealed = 0;
    let truncated = 0;
    let padFailed = 0;

    for (const span of spans) {
      if (isRevealed(span, editor.selections)) {
        revealed += 1;
        continue;
      }
      if (span.truncated) {
        truncated += 1;
      }
      if (span.padFailedWidth !== undefined) {
        padFailed += 1;
      }
      const { key: decorationKey } = this.pool.typeFor({
        replacement: span.replacement,
        cursorStop: span.rule.cursorStop,
        style: span.rule.style,
      });
      const options: vscode.DecorationOptions = {
        range: new vscode.Range(span.line, span.start, span.line, span.end),
      };
      if (span.rule.hover) {
        options.hoverMessage = new vscode.MarkdownString(
          `**${span.rule.id}** conceals \`${span.hidden.replace(/`/g, "\\`")}\``,
        );
      }
      const list = byKey.get(decorationKey);
      if (list) {
        list.push(options);
      } else {
        byKey.set(decorationKey, [options]);
      }
    }

    const previous = this.applied.get(key) ?? new Set<string>();
    for (const [decorationKey, options] of byKey) {
      const type = this.pool.typeByKey(decorationKey);
      if (type) {
        editor.setDecorations(type, options);
      }
    }
    for (const staleKey of previous) {
      if (!byKey.has(staleKey)) {
        const type = this.pool.typeByKey(staleKey);
        if (type) {
          editor.setDecorations(type, []);
        }
      }
    }
    this.applied.set(key, new Set(byKey.keys()));

    const stats: DocumentStats = {
      uri: key,
      included,
      concealEnabled,
      rulesApplied: rules.map((rule) => rule.id),
      spans: spans.length,
      revealed,
      decorationTypes: byKey.size,
      truncated,
      padFailed,
      budgetExhausted: budget.exhausted,
      elapsedMs: Date.now() - started,
    };
    this.documentStats.set(key, stats);
    if (this.settings.trace) {
      log.trace(
        `${key}: ${stats.spans} span(s), ${stats.decorationTypes} type(s), ${stats.revealed} revealed, ${stats.elapsedMs}ms`,
      );
    }
    if (budget.exhausted) {
      log.warn(
        `${key}: stopped at conceal-demo.maxMatchesPerFile (${this.settings.maxMatchesPerFile}) — the rest of the file is not concealed`,
      );
    }
  }

  private clear(editor: vscode.TextEditor): void {
    const key = editor.document.uri.toString();
    for (const decorationKey of this.applied.get(key) ?? []) {
      const type = this.pool.typeByKey(decorationKey);
      if (type) {
        editor.setDecorations(type, []);
      }
    }
    this.applied.set(key, new Set());
  }

  stats(): EngineStats {
    return {
      availability: this.availability,
      enabled: this.settings.enabled,
      userRules: this.user.rules.length,
      exampleRules: this.examples.rules.length,
      problems: [...this.user.problems, ...this.examples.problems],
      pool: this.pool.stats(),
      documents: [...this.documentStats.values()],
    };
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
    this.pool.dispose();
    this.applied.clear();
  }
}
