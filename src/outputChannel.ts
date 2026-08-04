import * as vscode from "vscode";

// A small dependency-free module so both configuration.ts (migration
// warnings) and renderer.ts (render logging) can write to the same channel
// without creating a circular import between them.
let channel: vscode.OutputChannel | undefined;

export function initOutputChannel(): vscode.OutputChannel {
  channel = vscode.window.createOutputChannel("Pandoc");
  return channel;
}

export function log(message: string): void {
  channel?.append(message);
}
