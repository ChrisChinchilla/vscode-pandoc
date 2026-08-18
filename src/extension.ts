import * as vscode from "vscode";
import { initOutputChannel } from "./outputChannel";
import { handleRenderCommand, handleSelectProfileCommand } from "./commands";

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = initOutputChannel();
  context.subscriptions.push(outputChannel);

  var renderDisposable = vscode.commands.registerCommand(
    "pandoc.render",
    (args?: { outputType: string }) => handleRenderCommand(context, args)
  );
  context.subscriptions.push(renderDisposable);

  var selectProfileDisposable = vscode.commands.registerCommand(
    "pandoc.selectProfile",
    () => handleSelectProfileCommand(context)
  );
  context.subscriptions.push(selectProfileDisposable);
}
