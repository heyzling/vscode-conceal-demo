import * as vscode from "vscode";

let channel: vscode.LogOutputChannel | undefined;

export function createLog(): vscode.LogOutputChannel {
  channel = vscode.window.createOutputChannel("Conceal Demo", { log: true });
  return channel;
}

function target(): vscode.LogOutputChannel | undefined {
  return channel;
}

export const log = {
  info(message: string): void {
    target()?.info(message);
  },
  warn(message: string): void {
    target()?.warn(message);
  },
  error(message: string): void {
    target()?.error(message);
  },
  trace(message: string): void {
    target()?.debug(message);
  },
  show(): void {
    target()?.show(true);
  },
};
