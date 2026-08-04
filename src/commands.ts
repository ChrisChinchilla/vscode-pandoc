import * as vscode from "vscode";
import * as path from "path";
import { SUPPORTED_FORMATS, isSupportedFormat } from "./formats";
import { getPandocDefaultFormat, resolveOutputFolder } from "./configuration";
import { renderDoc } from "./renderer";

function isLocalSavedDocument(document: vscode.TextDocument): boolean {
  if (document.isUntitled) {
    vscode.window.showErrorMessage(
      "pandoc: untitled documents cannot be rendered. Save the document to a local file first."
    );
    return false;
  }
  if (document.uri.scheme !== "file") {
    vscode.window.showErrorMessage(
      "pandoc: only local file documents can be rendered."
    );
    return false;
  }
  return true;
}

export async function handleRenderCommand(
  context: vscode.ExtensionContext,
  args?: { outputType: string }
): Promise<void> {
  // Workspace-controlled settings (executable, Docker options/image, Lua
  // filters, per-format flags) all feed into a spawned process in
  // renderer.ts, so this command must not run in an untrusted workspace.
  // package.json declares untrustedWorkspaces.supported: false as the
  // primary guard; this check defends the same path in case that
  // declaration doesn't apply (e.g. a future virtual-workspace or embedded
  // host).
  if (!vscode.workspace.isTrusted) {
    vscode.window.showErrorMessage(
      "pandoc: this command requires a trusted workspace because it runs the Pandoc executable, Docker, and workspace-configured filters."
    );
    return;
  }

  var defaultFormat = getPandocDefaultFormat();
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage(
      "pandoc: no active editor. Open a document to render it."
    );
    return;
  }
  if (!isLocalSavedDocument(editor.document)) {
    return;
  }

  // args.outputType arrives from outside this function's control (keybindings,
  // command URIs, other extensions), so it must be checked against the
  // allowlist before it can influence the output path or pandoc invocation.
  if (args?.outputType && !isSupportedFormat(args.outputType)) {
    vscode.window.showErrorMessage(
      'pandoc: "' + args.outputType + '" is not a supported output format.'
    );
    return;
  }

  var requestedFormat = args?.outputType ?? defaultFormat;

  if (!requestedFormat) {
    await displayMenuAndRender(context, editor);
  } else if (!isSupportedFormat(requestedFormat)) {
    // defaultFormat comes from a workspace-controlled setting; the manifest
    // enum is not a runtime guarantee, so it is re-checked here too.
    vscode.window.showErrorMessage(
      'pandoc: "' + requestedFormat + '" is not a supported output format. Check pandoc.defaultOutputFormat.'
    );
  } else {
    await saveAndRender(context, editor, requestedFormat);
  }
}

async function displayMenuAndRender(
  context: vscode.ExtensionContext,
  editor: vscode.TextEditor
): Promise<void> {
  const sortByFrequency = vscode.workspace
    .getConfiguration("pandoc")
    .get<boolean>("sortByFrequency", true);

  const usageCounts: Record<string, number> = context.globalState.get(
    "pandoc.formatUsage",
    {}
  );

  let items: vscode.QuickPickItem[] = SUPPORTED_FORMATS.map((f) => ({ ...f }));

  if (sortByFrequency) {
    // Sort by usage frequency (most used first); original order is preserved for ties.
    items.sort(
      (a, b) => (usageCounts[b.label] ?? 0) - (usageCounts[a.label] ?? 0)
    );
  }

  const qpSelection = await vscode.window.showQuickPick(items);
  if (!qpSelection) {
    return;
  }

  const updated = {
    ...usageCounts,
    [qpSelection.label]: (usageCounts[qpSelection.label] ?? 0) + 1,
  };
  await context.globalState.update("pandoc.formatUsage", updated);

  await saveAndRender(context, editor, qpSelection.label);
}

async function saveAndRender(
  context: vscode.ExtensionContext,
  editor: vscode.TextEditor,
  format: string
): Promise<void> {
  // Pandoc reads from disk, so save only after the user has confirmed a valid
  // format. Cancelling the picker or passing an invalid format must not modify
  // the document as a side effect.
  if (editor.document.isDirty) {
    const saved = await editor.document.save();
    if (!saved) {
      vscode.window.showErrorMessage(
        "pandoc: could not save the document before rendering. Save it manually and try again."
      );
      return;
    }
  }

  const fullName = path.normalize(editor.document.fileName);
  const filePath = path.dirname(fullName);
  const fileName = path.basename(fullName);
  const fileNameOnly = path.parse(fileName).name;

  const outputFolder = await resolveOutputFolder(filePath);
  if (outputFolder === null) {
    return;
  }

  await renderDoc(filePath, fileName, fileNameOnly, format, context.extensionPath, outputFolder);
}
