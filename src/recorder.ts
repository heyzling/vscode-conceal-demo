/**
 * Scripted playback behind the README's GIFs. Plays `examples/scenes.jsonc` inside the editor and
 * stops at every frame until `scripts/record.sh` has photographed it: the recorder writes
 * `<frame>.json` into the rendezvous directory named by `CONCEAL_DEMO_RECORD`, the script answers
 * with `<frame>.taken`. Nothing runs unless that variable is set, and nothing is saved to disk.
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/** One thing to do to the editor. */
export type Action =
  /** Open a workspace-relative file in the first column. */
  | { open: string }
  /** Put the caret at a 1-based line and column. */
  | { caret: [number, number] }
  /** Select from a 1-based line and column to another. Played live, it grows by Shift+arrow presses. */
  | { select: [number, number, number, number] }
  /** Type text through the editor's own type handler. */
  | { type: string }
  /** Run a command with `args`, `times` times. Defaults to once. */
  | { command: string; args?: unknown[]; times?: number }
  /** Change a user setting; it is put back when the scene ends. */
  | { setting: string; value: unknown }
  /** Put the selected text on the clipboard. */
  | { copy: true }
  /** Insert the clipboard at the caret. */
  | { paste: true }
  /** Open an empty untitled document beside the example. */
  | { openBeside: true }
  /** Close the untitled documents opened beside, back to one group. */
  | { closeBeside: true }
  /** Wait, in milliseconds. */
  | { wait: number };

/** What a frame shows, asserted by the e2e suite and ignored here. Lines and columns are 1-based. */
export interface Expect {
  /** The caret, or every caret when there are several. */
  caret?: [number, number] | [number, number][];
  /** The selection, anchor to active. */
  selection?: [number, number, number, number];
  /** Line numbers to the text they hold. */
  lines?: Record<string, string>;
  /** The text of the untitled document opened beside the example. */
  beside?: string;
  /** If true, the step left the example as it was. */
  unchanged?: boolean;
  /** A cursor command pressed with the caret at a position, and where the caret lands; the caret is
   * put back after. One → crossing a range whole is the model's own proof that it is concealed. */
  press?: Probe | Probe[];
}

/** `[command, from, to]`, positions 1-based. */
export type Probe = [string, [number, number], [number, number]];

/** One frame of the GIF: what to do, and the caption under it. */
export interface Step {
  caption?: string;
  /** Seconds the frame is held. Defaults to 2.4. */
  hold?: number;
  /** If set, every keystroke and every typed character is a frame of its own, held this many seconds. */
  live?: number;
  /** If true, the step is left out of the recording. */
  skip?: boolean;
  /** If true, the frame is a clip filmed by hand: the script records until it is told to stop. */
  manual?: boolean;
  do?: Action[];
  /** What the step's frame shows; a list is one per frame of a live step, the last for the final one. */
  expect?: Expect | Expect[];
}

export interface Scene {
  id: string;
  title?: string;
  /** The workspace-relative file the scene is about; the GIF is written beside it. */
  example: string;
  /** Window size in pixels, `[width, height]`. */
  window?: [number, number];
  steps: Step[];
}

export interface Script {
  /** Milliseconds to wait after a step's actions before its frame is declared ready. */
  settleMs?: number;
  scenes: Scene[];
}

/** Emits a frame of the current state, between the keystrokes of a live step. */
type Live = (() => Promise<void>) | undefined;

/** Called once a frame is ready: after every step, and between the keystrokes of a live step. */
export type Frame = (step: Step, live: boolean) => Promise<void>;

const DEFAULT_SETTLE_MS = 450;
const DEFAULT_HOLD = 2.4;
const FRAME_TIMEOUT_MS = 60_000;
const MANUAL_TIMEOUT_MS = 15 * 60_000;
const KEYSTROKE_TIMEOUT_MS = 500;
const MAX_SELECT_PRESSES = 200;
// Commands that must move the caret or change the document.
const KEYSTROKE = /^(cursor|delete|undo|redo|lineBreakInsert)/;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function active(): vscode.TextEditor {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error("no active editor");
  }
  return editor;
}

function workspaceRoot(): vscode.Uri {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error("recording needs a workspace folder");
  }
  return folder.uri;
}

/** Settings a scene changed, with what they were before. */
class Settings {
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

function editorState(): string {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return "";
  }
  const selections = editor.selections.map(
    (s) => `${s.anchor.line}:${s.anchor.character}-${s.active.line}:${s.active.character}`,
  );
  return `${editor.document.version} ${selections.join(",")}`;
}

/** Runs a command in the focused editor and returns once its effect has reached the extension host.
 * With `foreground`, a keystroke that changed nothing in a window without the foreground is an error. */
export async function press(command: string, args: unknown[] = [], foreground = true): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
  const before = editorState();
  await vscode.commands.executeCommand(command, ...args);
  if (!KEYSTROKE.test(command)) {
    return;
  }
  // A keystroke that changed nothing was dropped: the window did not hold the foreground.
  for (const deadline = Date.now() + KEYSTROKE_TIMEOUT_MS; editorState() === before; ) {
    if (Date.now() > deadline) {
      // A delete that reveals a concealed range takes nothing and moves nothing either, so the
      // window's own focus is what tells that from a keystroke the desktop swallowed.
      if (!foreground || vscode.window.state.focused) {
        return;
      }
      throw new Error(`${command} changed nothing (${before}); the recorded window must hold the foreground`);
    }
    await delay(20);
  }
}

async function type(text: string): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
  await vscode.commands.executeCommand("default:type", { text });
}

function setSelection(editor: vscode.TextEditor, selection: vscode.Selection): void {
  editor.selection = selection;
  editor.revealRange(selection);
}

/** Grows a selection from its anchor one Shift+arrow press at a time, with a frame before each. */
async function selectByKeys(range: [number, number, number, number], live: () => Promise<void>, foreground: boolean): Promise<void> {
  const [line, column, toLine, toColumn] = range;
  const editor = active();
  setSelection(editor, new vscode.Selection(line - 1, column - 1, line - 1, column - 1));
  const target = new vscode.Position(toLine - 1, toColumn - 1);
  const lineLength = editor.document.lineAt(target.line).text.length;

  let forward: boolean | undefined;
  for (let presses = 0; presses < MAX_SELECT_PRESSES; presses += 1) {
    const at = editor.selection.active;
    let key: string;
    if (at.line !== target.line) {
      key = at.line < target.line ? "cursorDownSelect" : "cursorUpSelect";
    } else if (at.character === target.character) {
      return;
    } else if (forward !== undefined && forward !== at.character < target.character) {
      // Passed the target: it was inside a concealed range, which a press crosses whole.
      return;
    } else {
      forward = at.character < target.character;
      if (target.character === lineLength) {
        key = "cursorEndSelect";
      } else if (target.character === 0) {
        key = "cursorLineStartSelect";
      } else {
        key = forward ? "cursorRightSelect" : "cursorLeftSelect";
      }
    }
    await live();
    await press(key, [], foreground);
  }
  throw new Error(`the selection did not reach ${toLine}:${toColumn}`);
}

async function perform(action: Action, settings: Settings, live: Live, foreground = true): Promise<void> {
  if ("open" in action) {
    const uri = vscode.Uri.joinPath(workspaceRoot(), action.open);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, { preview: false, viewColumn: vscode.ViewColumn.One });
  } else if ("caret" in action) {
    const [line, column] = action.caret;
    setSelection(active(), new vscode.Selection(line - 1, column - 1, line - 1, column - 1));
  } else if ("select" in action) {
    if (live) {
      await selectByKeys(action.select, live, foreground);
    } else {
      const [line, column, toLine, toColumn] = action.select;
      setSelection(active(), new vscode.Selection(line - 1, column - 1, toLine - 1, toColumn - 1));
    }
  } else if ("type" in action) {
    const pieces = live ? Array.from(action.type) : [action.type];
    for (const [index, piece] of pieces.entries()) {
      if (index > 0 && live) {
        await live();
      }
      await type(piece);
    }
  } else if ("command" in action) {
    for (let count = 0; count < (action.times ?? 1); count += 1) {
      if (count > 0 && live) {
        await live();
      }
      await press(action.command, action.args, foreground);
    }
  } else if ("setting" in action) {
    await settings.set(action.setting, action.value);
  } else if ("copy" in action) {
    // Not the clipboard command: that one needs the DOM to hold focus.
    const editor = active();
    await vscode.env.clipboard.writeText(editor.document.getText(editor.selection));
  } else if ("paste" in action) {
    const editor = active();
    const text = await vscode.env.clipboard.readText();
    await editor.edit((builder) => builder.replace(editor.selection, text));
  } else if ("openBeside" in action) {
    const document = await vscode.workspace.openTextDocument({ language: "markdown", content: "" });
    await vscode.window.showTextDocument(document, { preview: false, viewColumn: vscode.ViewColumn.Beside });
  } else if ("closeBeside" in action) {
    await closeUntitled();
    await vscode.commands.executeCommand("workbench.action.editorLayoutSingle");
    // Closing a group leaves the DOM focus outside the editor, which draws the selection inactive.
    const editor = vscode.window.visibleTextEditors[0];
    if (editor) {
      await vscode.window.showTextDocument(editor.document, { viewColumn: editor.viewColumn, preserveFocus: false });
    }
  } else {
    await delay(action.wait);
  }
}

/** Empties every untitled document and closes its tab. */
async function closeUntitled(): Promise<void> {
  for (const document of vscode.workspace.textDocuments) {
    // Emptied first: closing an untitled tab with content asks about saving.
    if (document.isUntitled && document.getText().length > 0) {
      const edit = new vscode.WorkspaceEdit();
      edit.delete(document.uri, new vscode.Range(0, 0, document.lineCount, 0));
      await vscode.workspace.applyEdit(edit);
    }
  }
  const tabs = vscode.window.tabGroups.all.flatMap((group) =>
    group.tabs.filter((tab) => tab.input instanceof vscode.TabInputText && tab.input.uri.scheme === "untitled"),
  );
  if (tabs.length > 0) {
    await vscode.window.tabGroups.close(tabs, false);
  }
}

/** Discards every edit, closes the find widget and every tab. */
async function reset(): Promise<void> {
  await vscode.commands.executeCommand("closeFindWidget");
  await closeUntitled();
  for (const document of vscode.workspace.textDocuments) {
    if (document.isDirty && !document.isUntitled) {
      await vscode.window.showTextDocument(document, { preview: false });
      await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
      await vscode.commands.executeCommand("workbench.action.files.revert");
    }
  }
  await delay(150);
  const tabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);
  if (tabs.length > 0) {
    await vscode.window.tabGroups.close(tabs, false);
  }
  await vscode.commands.executeCommand("workbench.action.editorLayoutSingle");
}

/** Cleanup that must not strand the run: a workbench prompt never returns. */
async function bounded(work: () => Promise<void>, what: string): Promise<void> {
  let finished = false;
  await Promise.race([work().then(() => void (finished = true)), delay(5000)]);
  if (!finished) {
    console.warn(`conceal-demo recorder: ${what} did not finish in time`);
  }
}

/** Announces a finished frame and waits for its capture. */
async function frame(dir: string, name: string, caption: string, hold: number, manual = false): Promise<void> {
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify({ name, caption, hold, manual }));
  const taken = path.join(dir, `${name}.taken`);
  const deadline = Date.now() + (manual ? MANUAL_TIMEOUT_MS : FRAME_TIMEOUT_MS);
  while (!fs.existsSync(taken)) {
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${name} to be captured`);
    }
    await delay(40);
  }
}

/** Plays one scene, handing every finished frame to `frame`, and puts the editor back as it was.
 * `foreground` is whether a keystroke that changed nothing counts as swallowed by the desktop. */
export async function play(scene: Scene, settleMs: number, frame: Frame, foreground = true): Promise<void> {
  await bounded(reset, `${scene.id}: reset`);
  const settings = new Settings();
  const snap = async (step: Step, live: boolean): Promise<void> => {
    await delay(settleMs);
    await frame(step, live);
  };
  try {
    await perform({ open: scene.example }, settings, undefined);
    for (const step of scene.steps) {
      if (step.skip) {
        continue;
      }
      const live: Live = step.live === undefined ? undefined : () => snap(step, true);
      await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
      for (const [index, action] of (step.do ?? []).entries()) {
        if (index > 0 && live) {
          await live();
        }
        await perform(action, settings, live, foreground);
      }
      await snap(step, false);
    }
  } finally {
    await bounded(reset, `${scene.id}: reset`);
    await bounded(() => settings.restore(), `${scene.id}: settings`);
  }
}

async function record(dir: string): Promise<void> {
  const script = JSON.parse(fs.readFileSync(path.join(dir, "scenes.jsonc"), "utf8")) as Script;
  await vscode.commands.executeCommand("workbench.action.closeSidebar");
  await vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
  await vscode.commands.executeCommand("workbench.action.closePanel");
  await delay(1200);

  let error: string | null = null;
  try {
    for (const scene of script.scenes) {
      let frames = 0;
      await play(scene, script.settleMs ?? DEFAULT_SETTLE_MS, (step, live) => {
        const name = `${scene.id}-${String(frames).padStart(3, "0")}`;
        frames += 1;
        const hold = (live ? step.live : step.hold) ?? DEFAULT_HOLD;
        return frame(dir, name, step.caption ?? "", hold, !live && step.manual);
      });
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  fs.writeFileSync(path.join(dir, "done.json"), JSON.stringify({ error }));
}

/** Arms the recorder when `CONCEAL_DEMO_RECORD` names a rendezvous directory; a no-op otherwise. */
export function activate(): void {
  const dir = process.env.CONCEAL_DEMO_RECORD;
  if (dir) {
    void record(dir);
  }
}
