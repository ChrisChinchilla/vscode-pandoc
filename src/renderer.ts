import * as vscode from "vscode";
import { execFile } from "child_process";
import { existsSync } from "fs";
import * as path from "path";
import { getOutputFileExtension } from "./formats";
import { buildCommand } from "./commandBuilder";
import {
  getPandocOptions,
  getPandocExecutablePath,
  getLuaFilterPaths,
  getDockerOptions,
  migrateDockerOptionsToArray,
  migrateUseDockerToDockerEnabled,
} from "./configuration";
import { log } from "./outputChannel";

const activeOutputPaths = new Set<string>();

export function setStatusBarText(what: string, docType: string, profileName?: string) {
  var date = new Date();
  var profileSuffix = profileName ? " (" + profileName + ")" : "";
  var text = what + " [" + docType + "]" + profileSuffix + " " + date.toLocaleTimeString();
  vscode.window.setStatusBarMessage(text, 1500);
}

export async function openDocument(outFile: string): Promise<void> {
  const opened = await vscode.env.openExternal(vscode.Uri.file(outFile));
  if (!opened) {
    vscode.window.showWarningMessage(
      "pandoc: the rendered document could not be opened in its default application."
    );
  }
}

export async function renderDoc(
  filePath: string,
  fileName: string,
  fileNameOnly: string,
  format: string,
  extensionPath?: string,
  outputFolder?: string,
  profileName?: string
): Promise<void> {
  var inFile = path.join(filePath, fileName);
  var outFolder = outputFolder || filePath;
  var outExt = getOutputFileExtension(format);
  var outFile = path.join(outFolder, fileNameOnly) + "." + outExt;

  // Some formats (gfm, commonmark -> .md; html -> .html) map back onto the
  // input's own extension, so the computed output path can equal the input
  // path and pandoc would truncate/overwrite the source file. macOS and
  // Windows filesystems are case-insensitive by default, so compare
  // case-insensitively there to catch that variant of the collision too.
  var resolvedIn = path.resolve(inFile);
  var resolvedOut = path.resolve(outFile);
  var isCaseInsensitiveFs =
    process.platform === "win32" || process.platform === "darwin";
  var collides = isCaseInsensitiveFs
    ? resolvedIn.toLowerCase() === resolvedOut.toLowerCase()
    : resolvedIn === resolvedOut;
  if (collides) {
    var message =
      'pandoc: output for format "' +
      format +
      '" would overwrite the source file (' +
      outFile +
      "). Choose a different format or rename the input file.";
    vscode.window.showErrorMessage(message);
    log(message + "\n");
    return;
  }

  const outputKey = isCaseInsensitiveFs ? resolvedOut.toLowerCase() : resolvedOut;
  if (activeOutputPaths.has(outputKey)) {
    vscode.window.showWarningMessage(
      "pandoc: a render is already in progress for " + outFile + "."
    );
    return;
  }
  activeOutputPaths.add(outputKey);

  try {
    if (existsSync(outFile)) {
      const choice = await vscode.window.showWarningMessage(
        "pandoc: " + outFile + " already exists. Overwrite it?",
        { modal: true },
        "Overwrite"
      );
      if (choice !== "Overwrite") {
        return;
      }
    }

    setStatusBarText("Generating", format, profileName);

    var pandocOptions = getPandocOptions(format, profileName);

    var pandocExecutablePath = getPandocExecutablePath();
    var pandocConfigurations = vscode.workspace.getConfiguration("pandoc");

    migrateUseDockerToDockerEnabled(pandocConfigurations);
    var useDocker = pandocConfigurations.get<boolean>("docker.enabled");
    migrateDockerOptionsToArray(pandocConfigurations);
    var dockerOptions = getDockerOptions(pandocConfigurations);
    var dockerImage = pandocConfigurations.get<string>("docker.image");

    var luaFilterPaths = getLuaFilterPaths(extensionPath);

    // Build command and argument list safely without going through a shell.
    const { command, args } = buildCommand({
      useDocker: !!useDocker,
      inFile,
      fileName,
      fileNameOnly,
      filePath,
      outFolder,
      outFile,
      outExt,
      format,
      pandocExecutablePath,
      pandocOptions,
      dockerOptions,
      dockerImage,
      luaFilterPaths,
    });

    const timeoutSeconds = Math.max(
      0,
      pandocConfigurations.get<number>("render.timeout", 300) ?? 300
    );

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title:
          "Pandoc: Rendering " + format + (profileName ? " (" + profileName + ")" : ""),
        cancellable: true,
      },
      async (_progress, token) => {
        const controller = new AbortController();
        const cancellation = token.onCancellationRequested(() => controller.abort());
        if (token.isCancellationRequested) {
          controller.abort();
        }
        try {
          await new Promise<void>((resolve) => {
            execFile(
              command,
              args,
              {
                cwd: filePath,
                signal: controller.signal,
                timeout: timeoutSeconds === 0 ? undefined : timeoutSeconds * 1000,
              },
              async (error, stdout, stderr) => {
                if (stdout !== null && stdout !== "") {
                  log(stdout.toString() + "\n");
                }

                if (stderr !== null && stderr !== "") {
                  log("stderr: " + stderr.toString() + "\n");
                  if (error === null) {
                    // Pandoc routinely writes non-fatal warnings (citeproc
                    // notices, deprecated-option notices, etc.) to stderr on
                    // an otherwise successful run, so a popup here should
                    // point at the output channel rather than dump the raw
                    // text, which can be long and looks like a failure.
                    vscode.window.showWarningMessage(
                      "pandoc: rendering produced warnings. See the Pandoc output channel for details."
                    );
                  }
                }

                if (error !== null) {
                  const wasCancelled = controller.signal.aborted;
                  const wasTimedOut = !wasCancelled && timeoutSeconds > 0 &&
                    (error as NodeJS.ErrnoException & { killed?: boolean }).killed;
                  log("exec error: " + error + "\n");
                  const message = wasCancelled
                    ? "pandoc: rendering was cancelled."
                    : wasTimedOut
                      ? "pandoc: rendering timed out after " + timeoutSeconds + " seconds."
                      : "pandoc: rendering failed. See the Pandoc output channel for details.";
                  vscode.window.showErrorMessage(message);
                } else {
                  const openViewer = vscode.workspace
                    .getConfiguration("pandoc")
                    .get("render.openViewer");

                  if (openViewer) {
                    setStatusBarText("Launching", format, profileName);
                    await openDocument(outFile);
                  }
                }
                resolve();
              }
            );
          });
        } finally {
          cancellation.dispose();
        }
      }
    );
  } finally {
    activeOutputPaths.delete(outputKey);
  }
}
