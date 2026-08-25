import * as vscode from "vscode";

/**
 * Whether this editor will actually conceal anything, and if not, which of the four reasons it is.
 *
 * A proposed API an extension host does not know is dropped in silence — on a stock build the
 * `conceal` option is simply an unknown property, the decoration type is created without
 * complaint, and nothing is hidden with nothing anywhere saying why. So availability is not
 * assumed from the fact that we asked for it; it is established in two independent steps, because
 * one step cannot tell the two failures apart:
 *
 * 1. **Does this build have the feature at all?** The editor registers `editor.concealedText` as a
 *    real setting, so a build carrying the proposal has a *default value* for it and a build
 *    without it has none. This is the only signal that distinguishes stock VS Code from the fork,
 *    and it does not depend on us being granted anything.
 * 2. **Are we allowed to use it?** `createTextEditorDecorationType` throws for an extension that
 *    passes `conceal` without the proposal enabled, and the error names the flag that fixes it. So
 *    the grant is probed by creating a throwaway decoration type and disposing it.
 *
 * The failure direction is the one the API documents for itself: when concealment cannot be
 * applied, text is shown. Never the reverse.
 */
export type ConcealAvailability =
  | { kind: "available" }
  | { kind: "no-build-support" }
  | { kind: "not-granted"; detail: string }
  | { kind: "disabled-by-setting" };

const EDITOR_SETTING = "editor.concealedText";

/** Step 1: this build knows what concealment is. */
export function buildSupportsConceal(): boolean {
  const inspected = vscode.workspace.getConfiguration().inspect<boolean>(EDITOR_SETTING);
  return inspected?.defaultValue !== undefined;
}

/** Step 2: this extension is allowed to ask for it. */
export function proposalGranted(): { granted: true } | { granted: false; detail: string } {
  let probe: vscode.TextEditorDecorationType | undefined;
  try {
    probe = vscode.window.createTextEditorDecorationType({ conceal: {} });
    return { granted: true };
  } catch (error) {
    return { granted: false, detail: (error as Error).message };
  } finally {
    probe?.dispose();
  }
}

export function detectConcealApi(): ConcealAvailability {
  if (!buildSupportsConceal()) {
    return { kind: "no-build-support" };
  }
  const grant = proposalGranted();
  if (!grant.granted) {
    return { kind: "not-granted", detail: grant.detail };
  }
  if (vscode.workspace.getConfiguration().get<boolean>(EDITOR_SETTING) === false) {
    return { kind: "disabled-by-setting" };
  }
  return { kind: "available" };
}

export function isAvailable(availability: ConcealAvailability): boolean {
  return availability.kind === "available";
}

/** Whether concealment is switched on **for this document**.
 *
 * `editor.concealedText` is a language-overridable setting, so a window where it is on can still
 * have it off for Markdown. A window-wide check would then report ranges as concealed while the
 * editor quietly draws every one of them, which is the one thing a demo of concealment must not
 * get wrong about itself. */
export function concealEnabledFor(document: vscode.TextDocument): boolean {
  return vscode.workspace.getConfiguration("editor", document).get<boolean>("concealedText") !== false;
}

/** One sentence naming what is running, for the status bar, the log and the warning. */
export function describe(availability: ConcealAvailability): string {
  switch (availability.kind) {
    case "available":
      return "the conceal API is available and in use";
    case "no-build-support":
      return `this build of ${vscode.env.appName} has no conceal API (no \`${EDITOR_SETTING}\` setting), so nothing is concealed`;
    case "not-granted":
      return `this build has a conceal API but has not granted it to this extension, so nothing is concealed — ${availability.detail}`;
    case "disabled-by-setting":
      return `\`${EDITOR_SETTING}\` is off, so nothing is concealed`;
  }
}
