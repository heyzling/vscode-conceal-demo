/**
 * Scripted playback, used to record the GIFs in the README.
 *
 * A demo of concealment is a demo of *behaviour* — what the caret does, what a delete takes, what
 * comes back when the selection arrives — and none of that survives a still screenshot. So the
 * editor is driven from inside: a scene is a list of steps, a step is a list of actions plus a
 * caption, and between two steps the recorder stops and waits for something outside to take a
 * picture.
 *
 * That wait is the whole design. The alternative — screenshotting on a timer and hoping the editor
 * had settled — produces frames of half-applied decorations. Here every frame is a state the
 * recorder declared finished:
 *
 *   1. the recorder performs a step's actions and lets the engine's debounce pass;
 *   2. it writes `<frame>.json` into the rendezvous directory and blocks;
 *   3. `scripts/record.sh` sees the file, captures the window, writes `<frame>.taken`;
 *   4. the recorder continues.
 *
 * Nothing here runs unless `CONCEAL_DEMO_RECORD` names that directory, which only
 * `scripts/record.sh` does. Nothing is ever written to a file in the workspace: edits made by a
 * scene are reverted, settings a scene changed are put back, and the files on disk are the same
 * before and after.
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { log } from "./log";

/** One thing to do to the editor. Deliberately small: everything a scene needs and nothing else. */
export type Action =
  /** Open a file, by workspace-relative path. */
  | { open: string }
  /** Put the caret at a 1-based line and column. */
  | { caret: [number, number] }
  /** Select from a 1-based line/column to another. */
  | { select: [number, number, number, number] }
  /** Type text the way a keyboard does, through the editor's own type handler. */
  | { type: string }
  /** Run a command — `cursorLeft`, `undo`, `actions.find`, a `conceal-demo.*` command. */
  | { command: string; args?: unknown[] }
  /** Change a setting, remembering the old value so it can be put back. */
  | { setting: string; value: unknown }
  /** Patch one example rule by id — how a scene shows a `cursorStop` making a difference. */
  | { rule: string; patch: Record<string, unknown> }
  /** Put the selected text on the system clipboard. */
  | { copy: true }
  /** Insert what is on the system clipboard at the caret. */
  | { paste: true }
  /** Put the open file back to what is on disk — undo granularity is the editor's business. */
  | { revert: true }
  /** Empty the active document, which is how an untitled one becomes closeable. */
  | { discard: true }
  /** Open an empty untitled document in the column beside, leaving the example on screen. */
  | { openBeside: true }
  /** Wait, for the rare case where a command animates. */
  | { wait: number };

/** A step is one frame: what to do, and what the caption under it says. */
export interface Step {
  caption?: string;
  /** Seconds the frame is held in the finished GIF. */
  hold?: number;
  do?: Action[];
}

export interface Scene {
  id: string;
  title?: string;
  /** The one file this scene is about, workspace-relative. Opened before the first step, and the
   * finished GIF is written beside it under the same name — a reader who has the picture has the
   * file, without a path burnt into the frames. */
  example: string;
  steps: Step[];
}

export interface RecordScript {
  /** Milliseconds to wait after a step's actions before the frame is declared ready. */
  settleMs?: number;
  scenes: Scene[];
}

const DEFAULT_SETTLE_MS = 450;
const FRAME_TIMEOUT_MS = 60_000;
const POLL_MS = 40;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function workspaceRoot(): vscode.Uri {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error("recording needs a workspace folder");
  }
  return folder.uri;
}

/** Settings a scene changed, and what they were before it did. */
class SettingsMemory {
  private readonly original = new Map<string, unknown>();

  async set(key: string, value: unknown): Promise<void> {
    if (!this.original.has(key)) {
      this.original.set(key, vscode.workspace.getConfiguration().inspect(key)?.globalValue);
    }
    await vscode.workspace.getConfiguration().update(key, value, vscode.ConfigurationTarget.Global);
  }

  async restore(): Promise<void> {
    for (const [key, value] of this.original) {
      await vscode.workspace.getConfiguration().update(key, value, vscode.ConfigurationTarget.Global);
    }
    this.original.clear();
  }
}

async function activeEditor(): Promise<vscode.TextEditor> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error("no active editor");
  }
  return editor;
}

async function perform(action: Action, settings: SettingsMemory): Promise<void> {
  if ("open" in action) {
    // Always the first column. Without it the file lands in whatever group happened to be active,
    // which after an `openBeside` is the split — and the scene's subject would open in the half of
    // the window meant for the tab it is compared against.
    const uri = vscode.Uri.joinPath(workspaceRoot(), action.open);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, {
      preview: false,
      viewColumn: vscode.ViewColumn.One,
    });
    return;
  }
  if ("caret" in action) {
    const editor = await activeEditor();
    const position = new vscode.Position(action.caret[0] - 1, action.caret[1] - 1);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position));
    return;
  }
  if ("select" in action) {
    const editor = await activeEditor();
    const [l1, c1, l2, c2] = action.select;
    editor.selection = new vscode.Selection(
      new vscode.Position(l1 - 1, c1 - 1),
      new vscode.Position(l2 - 1, c2 - 1),
    );
    editor.revealRange(editor.selection);
    return;
  }
  if ("type" in action) {
    await vscode.commands.executeCommand("default:type", { text: action.type });
    return;
  }
  if ("openBeside" in action) {
    // A new tab in the column beside rather than in this one: the example stays on screen, so the
    // frame that proves the clipboard carried the hidden characters shows both halves at once
    // instead of blinking the reader to a different tab.
    const document = await vscode.workspace.openTextDocument({ language: "markdown", content: "" });
    await vscode.window.showTextDocument(document, {
      preview: false,
      viewColumn: vscode.ViewColumn.Beside,
    });
    return;
  }
  if ("discard" in action) {
    const editor = await activeEditor();
    const document = editor.document;
    const edit = new vscode.WorkspaceEdit();
    edit.delete(document.uri, new vscode.Range(0, 0, document.lineCount, 0));
    await vscode.workspace.applyEdit(edit);
    return;
  }
  if ("revert" in action) {
    await vscode.commands.executeCommand("workbench.action.files.revert");
    return;
  }
  if ("copy" in action) {
    // Not `editor.action.clipboardCopyAction`: that one goes through the DOM, which needs the
    // window to hold focus, and a recorder that had to steal focus could not capture silently.
    // `env.clipboard` is the same system clipboard, reached from the extension host instead.
    const editor = await activeEditor();
    await vscode.env.clipboard.writeText(editor.document.getText(editor.selection));
    return;
  }
  if ("paste" in action) {
    const editor = await activeEditor();
    const text = await vscode.env.clipboard.readText();
    const target = editor.selection;
    await editor.edit((builder) => builder.replace(target, text));
    return;
  }
  if ("command" in action) {
    await vscode.commands.executeCommand(action.command, ...(action.args ?? []));
    return;
  }
  if ("setting" in action) {
    await settings.set(action.setting, action.value);
    return;
  }
  if ("rule" in action) {
    const key = "conceal-demo.exampleRules";
    const rules = vscode.workspace.getConfiguration().get<Record<string, unknown>[]>(key) ?? [];
    const patched = rules.map((rule) =>
      rule.id === action.rule ? { ...rule, ...action.patch } : rule,
    );
    await settings.set(key, patched);
    return;
  }
  await delay(action.wait);
}

/** Put every open document back the way it was on disk, then clear the editors.
 *
 * Scenes type and delete; the point of the whole extension is that the file never changes, so a
 * recording that left one modified would be lying about its subject. Nothing is ever saved, so
 * this only discards in-memory edits. */
async function revertAll(): Promise<void> {
  // Untitled documents first, and by emptying them rather than closing them. A scene pastes into
  // one to show what the clipboard carried, and an untitled editor is dirty exactly while it has
  // content — so emptying it is what keeps the close below from stopping to ask whether to save
  // it, and a cleanup that stops to ask never comes back. An edit rather than a command, because
  // commands go to the focused editor and cleanup runs between scenes, when nothing is focused.
  for (const document of vscode.workspace.textDocuments) {
    if (!document.isUntitled || document.getText().length === 0) {
      continue;
    }
    const edit = new vscode.WorkspaceEdit();
    edit.delete(document.uri, new vscode.Range(0, 0, document.lineCount, 0));
    await vscode.workspace.applyEdit(edit);
  }
  for (const document of vscode.workspace.textDocuments) {
    if (!document.isDirty || document.isUntitled) {
      continue;
    }
    await vscode.window.showTextDocument(document, { preview: false });
    await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    await vscode.commands.executeCommand("workbench.action.files.revert");
  }
  await delay(150);
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");

  // A scene that split the window leaves the second group behind, and a group left behind halves
  // the width of every picture the next scene takes. `closeAllEditors` empties the groups without
  // removing them, so the tabs that survived it are closed through the API that can say "close
  // this one" rather than "close what has focus".
  const left = vscode.window.tabGroups.all.flatMap((group) => group.tabs);
  if (left.length > 0) {
    await vscode.window.tabGroups.close(left, false);
  }
  await vscode.commands.executeCommand("workbench.action.editorLayoutSingle");
}

/** Run one cleanup step, but never let it stop the recording.
 *
 * Everything in here talks to the workbench, and a workbench command that decides to ask the user
 * something never comes back — which would strand the run with the frames it already has and no
 * way to say so. A scene that fails to tidy up costs a stale tab in the next scene's pictures; a
 * scene that hangs costs the recording. */
async function tidy(work: () => Promise<void>, what: string): Promise<void> {
  let finished = false;
  await Promise.race([
    work().then(() => {
      finished = true;
    }),
    delay(5000),
  ]);
  if (!finished) {
    log.warn(`${what} did not finish in time; carrying on`);
  }
}

/** Announce a finished frame and wait for the capture to happen. */
async function frame(dir: string, name: string, step: Step, index: number): Promise<void> {
  const ready = path.join(dir, `${name}.json`);
  const taken = path.join(dir, `${name}.taken`);
  fs.writeFileSync(
    ready,
    JSON.stringify({ name, index, caption: step.caption ?? "", hold: step.hold ?? 1.2 }),
  );
  const deadline = Date.now() + FRAME_TIMEOUT_MS;
  while (!fs.existsSync(taken)) {
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${name} to be captured`);
    }
    await delay(POLL_MS);
  }
}

async function playScene(dir: string, scene: Scene, settleMs: number): Promise<void> {
  log.info(`recording scene ${scene.id}`);
  await tidy(revertAll, `${scene.id}: clearing what the last scene left open`);
  const settings = new SettingsMemory();
  try {
    await perform({ open: scene.example }, settings);
    for (const [index, step] of scene.steps.entries()) {
      // Editor commands — typing, deleting, moving the caret — are routed to the focused editor,
      // and nothing here ever touches a keyboard, so each step puts focus back in the editor
      // before asking for one. Without it the commands are accepted and do nothing at all.
      await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
      for (const action of step.do ?? []) {
        await perform(action, settings);
      }
      await delay(settleMs);
      await frame(dir, `${scene.id}-${String(index).padStart(3, "0")}`, step, index);
    }
  } finally {
    await tidy(revertAll, `${scene.id}: putting the editors back`);
    await tidy(() => settings.restore(), `${scene.id}: putting the settings back`);
    await tidy(
      async () => void (await vscode.commands.executeCommand("workbench.action.closePanel")),
      `${scene.id}: closing the panel`,
    );
  }
}

/** Play every scene, in order, and tell `record.sh` when there will be no more frames. */
async function run(dir: string): Promise<void> {
  const script = JSON.parse(fs.readFileSync(path.join(dir, "scenes.json"), "utf8")) as RecordScript;
  const settleMs = script.settleMs ?? DEFAULT_SETTLE_MS;

  // The chrome is not the subject. Closing it here rather than in settings keeps the recording
  // profile's settings.json readable as "how the editor should look", not "what to hide".
  await vscode.commands.executeCommand("workbench.action.closeSidebar");
  await vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
  await vscode.commands.executeCommand("workbench.action.closePanel");
  await delay(1200);

  let error: string | undefined;
  try {
    for (const scene of script.scenes) {
      await playScene(dir, scene, settleMs);
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
    log.error(`recording failed: ${error}`);
  }
  fs.writeFileSync(path.join(dir, "done.json"), JSON.stringify({ error: error ?? null }));
  log.info("recording finished");
}

/** Entry point. Returns immediately on a normal run — `CONCEAL_DEMO_RECORD` is what arms this. */
export function startRecordingIfAsked(): void {
  const dir = process.env.CONCEAL_DEMO_RECORD;
  if (!dir) {
    return;
  }
  log.info(`recorder armed, rendezvous at ${dir}`);
  void run(dir);
}
