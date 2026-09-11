import * as vscode from "vscode";
import { execFile } from "child_process";
import { existsSync, readFileSync } from "fs";
import * as path from "path";
import { getOutputFileExtension, supportsReferenceDoc } from "./formats";
import { buildCommand } from "./commandBuilder";
import { getInFileArgs } from "./frontmatter";
import {
  getPandocOptions,
  getPandocExecutablePath,
  getLuaFilterPaths,
  getDockerOptions,
  isDocumentTemplatesEnabled,
  migrateDockerOptionsToArray,
  migrateUseDockerToDockerEnabled,
} from "./configuration";
import { log } from "./outputChannel";

const activeOutputPaths = new Set<string>();
const outputCompletionWaiters = new Map<string, Array<() => void>>();

export function setStatusBarText(what: string, docType: string, profileName?: string) {
  var date = new Date();
  var profileSuffix = profileName ? " (" + profileName + ")" : "";
  var text = what + " [" + docType + "]" + profileSuffix + " " + date.toLocaleTimeString();
  vscode.window.setStatusBarMessage(text, 1500);
}

// vscode.env.openExternal() turns the path into a file:// URI, and on
// Windows the underlying ShellExecute call mangles non-ASCII characters
// (e.g. Japanese filenames) in that URI, failing with "file not found"
// (0x2) even though the file exists. Shelling out to the OS's own opener
// with the plain path (no URI round-trip) sidesteps that. openExternal is
// kept as a fallback for platforms/environments where the OS opener isn't
// on PATH.
function openWithSystemHandler(outFile: string): Promise<void> {
  var command: string;
  var args: string[];
  const execOptions: import("child_process").ExecFileOptions = {};
  if (process.platform === "win32") {
    // Keep the filename out of command text entirely. ShellExecute opens the
    // literal Unicode path with its registered application; it does not parse
    // CMD operators or expand environment variables embedded in the filename.
    command = path.win32.join(
      process.env.SystemRoot || "C:\\Windows",
      "System32", "WindowsPowerShell", "v1.0", "powershell.exe"
    );
    args = ["-NoProfile", "-NonInteractive", "-Command",
      "$ErrorActionPreference = 'Stop'; " +
      "$info = New-Object System.Diagnostics.ProcessStartInfo; " +
      "$info.FileName = $env:VSCODE_PANDOC_OUTPUT_FILE; " +
      "$info.UseShellExecute = $true; " +
      "[void][System.Diagnostics.Process]::Start($info)"];
    execOptions.env = { ...process.env, VSCODE_PANDOC_OUTPUT_FILE: outFile };
    execOptions.windowsHide = true;
  } else if (process.platform === "darwin") {
    command = "open";
    args = [outFile];
  } else {
    command = "xdg-open";
    args = [outFile];
  }

  return new Promise((resolve, reject) => {
    execFile(command, args, execOptions, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export async function openDocument(outFile: string): Promise<void> {
  try {
    await openWithSystemHandler(outFile);
    return;
  } catch (error) {
    log(
      "warning: could not open " +
        outFile +
        " with the OS default handler, falling back to vscode.env.openExternal: " +
        error +
        "\n"
    );
  }

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
  profileName?: string,
  options: {
    skipOverwritePrompt?: boolean;
    waitForActiveRender?: boolean;
    workspaceFolder?: string;
  } = {}
): Promise<void> {
  const { skipOverwritePrompt, workspaceFolder } = options;
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
    if (options.waitForActiveRender) {
      // Automatic renders wait for a manual/in-flight render instead of being
      // discarded. commands.ts coalesces further saves while this waits.
      await new Promise<void>((resolve) => {
        const waiters = outputCompletionWaiters.get(outputKey) ?? [];
        waiters.push(resolve);
        outputCompletionWaiters.set(outputKey, waiters);
      });
      return renderDoc(
        filePath,
        fileName,
        fileNameOnly,
        format,
        extensionPath,
        outputFolder,
        profileName,
        options
      );
    }
    vscode.window.showWarningMessage(
      "pandoc: a render is already in progress for " + outFile + "."
    );
    return;
  }
  activeOutputPaths.add(outputKey);

  try {
    if (existsSync(outFile) && !skipOverwritePrompt) {
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

    var inFileArgs: string[] = [];
    if (pandocConfigurations.get<boolean>("readInFileArgs", false)) {
      try {
        inFileArgs = getInFileArgs(readFileSync(inFile, "utf8"), format);
      } catch (e) {
        log("warning: could not read in-file pandoc args from " + inFile + ": " + e + "\n");
      }
    }

    // Relative resources (--css, images, etc.) in pandocOptions/inFileArgs
    // resolve against `filePath` (this file's own directory, see the `cwd`
    // passed to execFile below), which trips people up when they instead
    // wrote the path relative to their workspace root. Docker is excluded:
    // its container only has `filePath` bind-mounted, so a host path outside
    // it wouldn't resolve inside the container anyway.
    var resourcePathDirs = [path.resolve(filePath)];
    if (workspaceFolder) {
      var resolvedWorkspaceFolder = path.resolve(workspaceFolder);
      if (!resourcePathDirs.includes(resolvedWorkspaceFolder)) {
        resourcePathDirs.push(resolvedWorkspaceFolder);
      }
    }
    var resourcePathArg =
      !useDocker && resourcePathDirs.length > 1
        ? resourcePathDirs.join(path.delimiter)
        : undefined;

    // Convention-based document template: if enabled and this format takes a
    // --reference-doc (docx, odt, pptx), look for "<name>.template.<format>"
    // next to the source file (e.g. report.md -> report.template.docx) and
    // use it automatically, with no per-document settings.json editing.
    var documentTemplateArg: string | undefined;
    if (isDocumentTemplatesEnabled() && supportsReferenceDoc(format)) {
      var templateFileName = fileNameOnly + ".template." + format;
      var templateHostPath = path.join(filePath, templateFileName);
      log("Checking for document template at: " + templateHostPath + "\n");
      if (existsSync(templateHostPath)) {
        log("Document template found, using as --reference-doc: " + templateHostPath + "\n");
        // In Docker mode only `filePath` is bind-mounted (at /data), and the
        // main input file is likewise referenced by its bare name rather
        // than a host path, so the template follows the same convention.
        documentTemplateArg = useDocker ? templateFileName : templateHostPath;
      }
    }

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
      inFileArgs,
      resourcePathArg,
      documentTemplateArg,
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
                    // Some desktop openers live as long as the viewer. Release
                    // the render lock independently, and handle launch failures
                    // even after this render has completed.
                    void openDocument(outFile).catch((openError) => {
                      log("warning: could not open rendered document: " + openError + "\n");
                      vscode.window.showWarningMessage(
                        "pandoc: the rendered document could not be opened in its default application."
                      );
                    });
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
    const waiters = outputCompletionWaiters.get(outputKey) ?? [];
    outputCompletionWaiters.delete(outputKey);
    waiters.forEach((resolve) => resolve());
  }
}
