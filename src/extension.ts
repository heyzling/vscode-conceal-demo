import * as vscode from "vscode";
import { ConcealAvailability, describe, detectConcealApi, isAvailable } from "./concealApi";
import { SECTION, affectsSettings } from "./config";
import { ConcealEngine, EngineStats } from "./engine";
import { createLog, log } from "./log";
import { renderStats } from "./report";

const SUPPRESS_WARNING_KEY = "conceal-demo.suppressUnavailableWarning";

/** What the integration tests reach for. Nothing here is meant for other extensions. */
export interface ConcealDemoApi {
  availability: ConcealAvailability;
  stats(): EngineStats;
  refresh(): void;
}

/** Says once, per window, that the editor cannot do this — and then gets out of the way.
 *
 * Silence is the failure this exists to prevent: on a build without the API the decoration is
 * accepted and simply does nothing, which looks exactly like a broken rule. Nothing else changes:
 * no decoration is created, no text is touched, and every command still answers. */
async function warnUnavailable(
  context: vscode.ExtensionContext,
  availability: ConcealAvailability,
): Promise<void> {
  const message = `Conceal Demo is disabled — ${describe(availability)}.`;
  log.warn(message);
  if (context.globalState.get<boolean>(SUPPRESS_WARNING_KEY) === true) {
    return;
  }
  const choice = await vscode.window.showWarningMessage(message, "Show Log", "Don't Show Again");
  if (choice === "Show Log") {
    log.show();
  } else if (choice === "Don't Show Again") {
    await context.globalState.update(SUPPRESS_WARNING_KEY, true);
  }
}

export function activate(context: vscode.ExtensionContext): ConcealDemoApi {
  context.subscriptions.push(createLog());

  const availability = detectConcealApi();
  log.info(`Conceal Demo starting in ${vscode.env.appName} — ${describe(availability)}`);

  const engine = new ConcealEngine(availability);
  context.subscriptions.push(engine);

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
  status.command = "conceal-demo.showStats";
  context.subscriptions.push(status);

  const updateStatus = (): void => {
    const stats = engine.stats();
    if (!isAvailable(availability)) {
      status.text = "$(eye) Conceal: unavailable";
      status.tooltip = describe(availability);
      status.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    } else if (!stats.enabled) {
      status.text = "$(eye) Conceal: off";
      status.tooltip = "conceal-demo.enabled is false";
      status.backgroundColor = undefined;
    } else {
      const rules = stats.userRules + stats.exampleRules;
      status.text = `$(eye-closed) Conceal: ${rules} rule${rules === 1 ? "" : "s"}`;
      status.tooltip = "Conceal Demo — click for statistics";
      status.backgroundColor = undefined;
    }
    status.show();
  };
  updateStatus();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!affectsSettings(event)) {
        return;
      }
      engine.reload();
      updateStatus();
    }),
    vscode.commands.registerCommand("conceal-demo.toggle", async () => {
      const config = vscode.workspace.getConfiguration(SECTION);
      const next = !config.get<boolean>("enabled", true);
      await config.update("enabled", next, vscode.ConfigurationTarget.Global);
      log.info(`concealment turned ${next ? "on" : "off"}`);
    }),
    vscode.commands.registerCommand("conceal-demo.showStats", () => {
      log.info(`\n${renderStats(engine.stats())}`);
      log.show();
    }),
    vscode.commands.registerCommand("conceal-demo.showLog", () => {
      log.show();
    }),
  );

  if (!isAvailable(availability)) {
    void warnUnavailable(context, availability);
  }

  return {
    availability,
    stats: () => engine.stats(),
    refresh: () => engine.refreshAll(),
  };
}

export function deactivate(): void {
  // Everything is registered in context.subscriptions.
}
