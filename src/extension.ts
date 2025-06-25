import * as vscode from "vscode";
import { exec } from "child_process";
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
        .get("pdfOptString");
      break;
    case "docx":
      pandocOptions = vscode.workspace
        .getConfiguration("pandoc")
        .get("docxOptString");
      break;
    case "html":
      pandocOptions = vscode.workspace
        .getConfiguration("pandoc")
        .get("htmlOptString");
      break;
    case "asciidoc":
      pandocOptions = vscode.workspace
        .getConfiguration("pandoc")
        .get("asciidocOptString");
      break;
    case "docbook":
      pandocOptions = vscode.workspace
        .getConfiguration("pandoc")
        .get("docbookOptString");
      break;
    case "epub":
      pandocOptions = vscode.workspace
        .getConfiguration("pandoc")
        .get("epubOptString");
      break;
    case "rst":
      pandocOptions = vscode.workspace
        .getConfiguration("pandoc")
        .get("rstOptString");
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
  var defaultFormat = getPandocDefaultFormat();
  var disposable = vscode.commands.registerCommand(
    "pandoc.render",
    (args?: { outputType: string }) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      let fullName = path.normalize(editor.document.fileName);
      var filePath = path.dirname(fullName);
      var fileName = path.basename(fullName);
      var fileNameOnly = path.parse(fileName).name;

      if (!defaultFormat && !args?.outputType) {
        // Nothing is set
        displayMenuAndRender(filePath, fileName, fileNameOnly);
      } else if (args?.outputType && !defaultFormat) {
        // If there is an output type selected, but no default format, then use the selected output type.
        renderDoc(filePath, fileName, fileNameOnly, args.outputType);
      } else if (args?.outputType) {
        // If the user has selected an output type, use that, overriding any default format.
        renderDoc(filePath, fileName, fileNameOnly, args.outputType);
      } else if (defaultFormat && !args?.outputType) {
        // Dfault format and no args, then use the default format.
        renderDoc(filePath, fileName, fileNameOnly, defaultFormat);
      }
    }
  );

  context.subscriptions.push(disposable);
}

function displayMenuAndRender(
  filePath: string,
  fileName: string,
  fileNameOnly: string
) {
  let items: vscode.QuickPickItem[] = [];
  items.push({ label: "pdf", description: "Render as pdf document" });
  items.push({ label: "docx", description: "Render as word document" });
  items.push({ label: "html", description: "Render as html document" });
  items.push({
    label: "asciidoc",
    description: "Render as asciidoc document",
  });
  items.push({
    label: "docbook",
    description: "Render as docbook document",
  });
  items.push({ label: "epub", description: "Render as epub document" });
  items.push({ label: "rst", description: "Render as rst document" });

  vscode.window.showQuickPick(items).then((qpSelection) => {
    if (!qpSelection) {
      return;
    } else {
      renderDoc(filePath, fileName, fileNameOnly, qpSelection.label);
    }
  });
}
function renderDoc(
  filePath: string,
  fileName: string,
  fileNameOnly: string,
  format: string
) {
  var inFile = path
    .join(filePath, fileName)
    .replace(/(^.*$)/gm, '"' + "$1" + '"');
  var outFile = (path.join(filePath, fileNameOnly) + "." + format).replace(
    /(^.*$)/gm,
    '"' + "$1" + '"'
  );

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
  var useDocker = pandocConfigurations.get("docker.enabled");
  var dockerOptions = pandocConfigurations.get("docker.options");
  var dockerImage = pandocConfigurations.get("docker.image");

  var targetExec = useDocker
    ? `docker run --rm -v "${filePath}:/data" ${dockerOptions} ${dockerImage} "${fileName}" -o "${fileNameOnly}.${format}" ${pandocOptions}`
    : `"${pandocExecutablePath}" ${inFile} -o ${outFile} ${pandocOptions}`;

  var child = exec(
    targetExec,
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
