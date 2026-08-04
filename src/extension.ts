import * as vscode from "vscode";
import { initOutputChannel } from "./outputChannel";
import { handleRenderCommand } from "./commands";

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = initOutputChannel();
  context.subscriptions.push(outputChannel);

  var disposable = vscode.commands.registerCommand(
    "pandoc.render",
    (args?: { outputType: string }) => handleRenderCommand(context, args)
  );

  context.subscriptions.push(disposable);
}
