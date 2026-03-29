import * as vscode from "vscode";
import { exec, execFile } from "child_process";
import * as path from "path";

var pandocOutputChannel = vscode.window.createOutputChannel("Pandoc");

function setStatusBarText(what: string, docType: string) {
  var date = new Date();
  var text = what + " [" + docType + "] " + date.toLocaleTimeString();
  vscode.window.setStatusBarMessage(text, 1500);
}

function getPandocOptions(quickPickLabel: string) {
  var pandocOptions;

  switch (quickPickLabel) {
    case "pdf":
      pandocOptions = vscode.workspace
        .getConfiguration("pandoc")
        .get<string>("pdfOptString");
      break;
    case "docx":
      pandocOptions = vscode.workspace
        .getConfiguration("pandoc")
        .get<string>("docxOptString");
      break;
    case "html":
      pandocOptions = vscode.workspace
        .getConfiguration("pandoc")
        .get<string>("htmlOptString");
      break;
    case "asciidoc":
      pandocOptions = vscode.workspace
        .getConfiguration("pandoc")
        .get<string>("asciidocOptString");
      break;
    case "docbook":
      pandocOptions = vscode.workspace
        .getConfiguration("pandoc")
        .get<string>("docbookOptString");
      break;
    case "epub":
      pandocOptions = vscode.workspace
        .getConfiguration("pandoc")
        .get<string>("epubOptString");
      break;
    case "rst":
      pandocOptions = vscode.workspace
        .getConfiguration("pandoc")
        .get<string>("rstOptString");
      break;
  }

  return pandocOptions;
}

function openDocument(outFile: string) {
  switch (process.platform) {
    case "darwin":
      exec("open " + outFile);
      break;
    case "linux":
      exec("xdg-open " + outFile);
      break;
    default:
      exec(outFile);
  }
}

function getPandocExecutablePath() {
  // By default pandoc executable should be in the PATH environment variable.
  var pandocExecutablePath;
  if (
    vscode.workspace.getConfiguration("pandoc").has("executable") &&
    vscode.workspace.getConfiguration("pandoc").get("executable") !== ""
  ) {
    pandocExecutablePath = vscode.workspace
      .getConfiguration("pandoc")
      .get("executable");
  }
  return pandocExecutablePath;
}

function getLuaFilters(extensionPath?: string): string[] {
  var luaFilters = vscode.workspace
    .getConfiguration("pandoc")
    .get<string[]>("luaFilters", []);
  var filters: string[] = luaFilters ? [...luaFilters] : [];

  var enableAdmonitions = vscode.workspace
    .getConfiguration("pandoc")
    .get<boolean>("enableAdmonitions", false);
  if (enableAdmonitions && extensionPath) {
    var admonitionFilter = path.join(
      extensionPath,
      "filters",
      "docusaurus-admonitions.lua"
    );
    filters.unshift(admonitionFilter);
  }

  if (filters.length === 0) {
    return [];
  }
  // Return each filter as separate CLI arguments: ["--lua-filter", "<path>", ...]
  var args: string[] = [];
  filters.forEach((f: string) => {
    args.push("--lua-filter");
    args.push(f);
  });
  return args;
}

function getPandocDefaultFormat(): string | undefined {
  // TODO: Works, but seems to need a hard refresh.
  if (
    (
      vscode.workspace
        .getConfiguration("pandoc")
        .get("defaultOutputFormat") as string
    ).length > 0
  ) {
    return vscode.workspace
      .getConfiguration("pandoc")
      .get("defaultOutputFormat") as string;
  } else {
    return undefined;
  }
}

export function activate(context: vscode.ExtensionContext) {
  var disposable = vscode.commands.registerCommand(
    "pandoc.render",
    (args?: { outputType: string }) => {
      var defaultFormat = getPandocDefaultFormat();
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      let fullName = path.normalize(editor.document.fileName);
      var filePath = path.dirname(fullName);
      var fileName = path.basename(fullName);
      var fileNameOnly = path.parse(fileName).name;

      var extensionPath = context.extensionPath;

      if (!defaultFormat && !args?.outputType) {
        // Nothing is set
        displayMenuAndRender(context, filePath, fileName, fileNameOnly, extensionPath);
      } else if (args?.outputType && !defaultFormat) {
        // If there is an output type selected, but no default format, then use the selected output type.
        renderDoc(filePath, fileName, fileNameOnly, args.outputType, extensionPath);
      } else if (args?.outputType) {
        // If the user has selected an output type, use that, overriding any default format.
        renderDoc(filePath, fileName, fileNameOnly, args.outputType, extensionPath);
      } else if (defaultFormat && !args?.outputType) {
        // Dfault format and no args, then use the default format.
        renderDoc(filePath, fileName, fileNameOnly, defaultFormat, extensionPath);
      }
    }
  );

  context.subscriptions.push(disposable);
}

function displayMenuAndRender(
  context: vscode.ExtensionContext,
  filePath: string,
  fileName: string,
  fileNameOnly: string,
  extensionPath: string
) {
  const sortByFrequency = vscode.workspace
    .getConfiguration("pandoc")
    .get<boolean>("sortByFrequency", true);

  const usageCounts: Record<string, number> = context.globalState.get(
    "pandoc.formatUsage",
    {}
  );

  let items: vscode.QuickPickItem[] = [
    { label: "pdf", description: "Render as pdf document" },
    { label: "docx", description: "Render as word document" },
    { label: "html", description: "Render as html document" },
    { label: "asciidoc", description: "Render as asciidoc document" },
    { label: "docbook", description: "Render as docbook document" },
    { label: "epub", description: "Render as epub document" },
    { label: "rst", description: "Render as rst document" },
  ];

  if (sortByFrequency) {
    // Sort by usage frequency (most used first); original order is preserved for ties.
    items.sort(
      (a, b) => (usageCounts[b.label] ?? 0) - (usageCounts[a.label] ?? 0)
    );
  }

  vscode.window.showQuickPick(items).then(async (qpSelection) => {
    if (!qpSelection) {
      return;
    }

    const updated = {
      ...usageCounts,
      [qpSelection.label]: (usageCounts[qpSelection.label] ?? 0) + 1,
    };
    await context.globalState.update("pandoc.formatUsage", updated);

    renderDoc(filePath, fileName, fileNameOnly, qpSelection.label, extensionPath);
  });
}
function renderDoc(
  filePath: string,
  fileName: string,
  fileNameOnly: string,
  format: string,
  extensionPath?: string
) {
  var inFile = path.join(filePath, fileName);
  var outFile = path.join(filePath, fileNameOnly) + "." + format;

  setStatusBarText("Generating", format);

  var pandocOptions = getPandocOptions(format);

  var pandocExecutablePath = getPandocExecutablePath();
  var pandocConfigurations = vscode.workspace.getConfiguration("pandoc");

  var deprecatedUseDockerGlobal =
    pandocConfigurations.inspect("useDocker")?.globalValue ?? undefined;
  if (deprecatedUseDockerGlobal !== undefined) {
    pandocOutputChannel.append(
      'migrating global configuration "pandoc.useDocker" -> "pandoc.docker.enabled"\n'
    );
    vscode.window.showWarningMessage(
      'pandoc: found deprecated value in global configuration. Migrating configuration "pandoc.useDocker" -> "pandoc.docker.enabled".'
    );
    pandocConfigurations.update(
      "docker.enabled",
      deprecatedUseDockerGlobal,
      vscode.ConfigurationTarget.Global
    );
    pandocConfigurations.update(
      "useDocker",
      undefined,
      vscode.ConfigurationTarget.Global
    );
  }
  var deprecatedUseDockerWorkspace =
    pandocConfigurations.inspect("useDocker")?.workspaceValue ?? undefined;
  if (deprecatedUseDockerWorkspace !== undefined) {
    pandocOutputChannel.append(
      'migrating workspace configuration "pandoc.useDocker" -> "pandoc.docker.enabled"\n'
    );
    vscode.window.showWarningMessage(
      'pandoc: found deprecated value in workspace configuration. Migrating configuration "pandoc.useDocker" -> "pandoc.docker.enabled".'
    );
    pandocConfigurations.update(
      "docker.enabled",
      deprecatedUseDockerWorkspace,
      vscode.ConfigurationTarget.Workspace
    );
    pandocConfigurations.update(
      "useDocker",
      undefined,
      vscode.ConfigurationTarget.Workspace
    );
  }
  var deprecatedUseDockerFolder =
    pandocConfigurations.inspect("useDocker")?.workspaceFolderValue ??
    undefined;
  if (deprecatedUseDockerFolder !== undefined) {
    pandocOutputChannel.append(
      'migrating folder configuration "pandoc.useDocker" -> "pandoc.docker.enabled"\n'
    );
    vscode.window.showWarningMessage(
      'pandoc: found deprecated value in folder configuration. Migrating configuration "pandoc.useDocker" -> "pandoc.docker.enabled".'
    );
    pandocConfigurations.update(
      "docker.enabled",
      deprecatedUseDockerFolder,
      vscode.ConfigurationTarget.WorkspaceFolder
    );
    pandocConfigurations.update(
      "useDocker",
      undefined,
      vscode.ConfigurationTarget.WorkspaceFolder
    );
  }
  var useDocker = pandocConfigurations.get<boolean>("docker.enabled");
  var dockerOptions = pandocConfigurations.get<string>("docker.options");
  var dockerImage = pandocConfigurations.get<string>("docker.image");

  var luaFilterArgs = getLuaFilters(extensionPath);

  // Build command and argument list safely without going through a shell.
  var command: string;
  var args: string[] = [];

  if (useDocker) {
    command = "docker";
    args = [
      "run",
      "--rm",
      "-v",
      filePath + ":/data",
    ];
    if (dockerOptions) {
      // dockerOptions is expected to be a string of options; split on whitespace.
      // This preserves existing behavior while avoiding shell interpolation of luaFilterArgs.
      args = args.concat(dockerOptions.split(/\s+/).filter(Boolean));
    }
    args.push(String(dockerImage));
    args.push(fileName);
    args.push("-o");
    args.push(fileNameOnly + "." + format);
    if (pandocOptions) {
      args = args.concat(pandocOptions.split(/\s+/).filter(Boolean));
    }
    if (luaFilterArgs.length > 0) {
      args = args.concat(luaFilterArgs);
    }
  } else {
    command = String(pandocExecutablePath);
    args.push(inFile);
    args.push("-o");
    args.push(outFile);
    if (pandocOptions) {
      args = args.concat(pandocOptions.split(/\s+/).filter(Boolean));
    }
    if (luaFilterArgs.length > 0) {
      args = args.concat(luaFilterArgs);
    }
  }

  execFile(
    command,
    args,
    { cwd: filePath },
    function (error, stdout, stderr) {
      if (stdout !== null) {
        pandocOutputChannel.append(stdout.toString() + "\n");
      }

      if (stderr !== null) {
        if (stderr !== "") {
          vscode.window.showErrorMessage("stderr: " + stderr.toString());
          pandocOutputChannel.append("stderr: " + stderr.toString() + "\n");
        }
      }

      if (error !== null) {
        vscode.window.showErrorMessage("exec error: " + error);
        pandocOutputChannel.append("exec error: " + error + "\n");
      } else {
        var openViewer = vscode.workspace
          .getConfiguration("pandoc")
          .get("render.openViewer");

        if (openViewer) {
          setStatusBarText("Launching", format);
          openDocument(outFile);
        }
      }
    }
  );
}
