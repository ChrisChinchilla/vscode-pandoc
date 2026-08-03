import * as vscode from "vscode";
import { execFile } from "child_process";
import * as path from "path";

var pandocOutputChannel = vscode.window.createOutputChannel("Pandoc");

function setStatusBarText(what: string, docType: string) {
  var date = new Date();
  var text = what + " [" + docType + "] " + date.toLocaleTimeString();
  vscode.window.setStatusBarMessage(text, 1500);
}

function parseShellArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let closingQuoteIndex = i + 1;
      while (closingQuoteIndex < input.length && input[closingQuoteIndex] !== quote) {
        closingQuoteIndex++;
      }

      if (closingQuoteIndex >= input.length) {
        current += ch;
        i++;
      } else {
        i++;
        while (i < input.length && input[i] !== quote) {
          current += input[i];
          i++;
        }
        i++; // skip closing quote
      }
    } else if (/\s/.test(ch)) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      i++;
    } else {
      current += ch;
      i++;
    }
  }
  if (current.length > 0) {
    args.push(current);
  }
  return args;
}

// Canonical catalogue of formats pandoc.render accepts: one source of truth
// for the quick pick, the runtime allowlist for `outputType` (command
// arguments, keybindings, command URIs, other extensions), the output file
// extension, and the `pandoc.<label>OptString` settings key. Previously this
// was three separate hand-maintained copies (the picker items, an extension
// switch, and a 29-case options switch).
interface PandocFormat {
  label: string;
  description: string;
  /** Output file extension, without the leading dot. Defaults to `label` when omitted. */
  extension?: string;
}

const SUPPORTED_FORMATS: PandocFormat[] = [
  { label: "pdf", description: "Render as pdf document" },
  { label: "docx", description: "Render as word document" },
  { label: "html", description: "Render as html document" },
  { label: "asciidoc", description: "Render as asciidoc document", extension: "adoc" },
  { label: "docbook", description: "Render as docbook document", extension: "xml" },
  { label: "epub", description: "Render as epub document" },
  { label: "rst", description: "Render as rst document" },
  { label: "odt", description: "Render as odt (OpenDocument Text) document" },
  { label: "pptx", description: "Render as pptx (PowerPoint) document" },
  { label: "latex", description: "Render as latex document", extension: "tex" },
  { label: "beamer", description: "Render as beamer (LaTeX presentation) document", extension: "tex" },
  { label: "rtf", description: "Render as rtf (Rich Text Format) document" },
  { label: "org", description: "Render as org (Emacs Org-mode) document" },
  { label: "mediawiki", description: "Render as mediawiki document" },
  { label: "textile", description: "Render as textile document" },
  { label: "dokuwiki", description: "Render as dokuwiki document" },
  { label: "jira", description: "Render as jira markup document" },
  { label: "ipynb", description: "Render as ipynb (Jupyter Notebook) document" },
  { label: "typst", description: "Render as typst document", extension: "typ" },
  { label: "plain", description: "Render as plain text document", extension: "txt" },
  { label: "gfm", description: "Render as gfm (GitHub-Flavored Markdown) document", extension: "md" },
  { label: "commonmark", description: "Render as commonmark document", extension: "md" },
  { label: "opml", description: "Render as opml document" },
  { label: "icml", description: "Render as icml (InDesign) document" },
  { label: "jats", description: "Render as jats (JATS XML) document", extension: "xml" },
  { label: "man", description: "Render as man (Unix man page) document" },
  { label: "texinfo", description: "Render as texinfo (GNU Texinfo) document", extension: "texi" },
  { label: "fb2", description: "Render as fb2 (FictionBook2) document" },
  { label: "revealjs", description: "Render as revealjs (Reveal.js presentation) document", extension: "html" },
];

const SUPPORTED_FORMATS_BY_LABEL = new Map(SUPPORTED_FORMATS.map((f) => [f.label, f]));

function isSupportedFormat(format: string): boolean {
  return SUPPORTED_FORMATS_BY_LABEL.has(format);
}

function getOutputFileExtension(format: string): string {
  return SUPPORTED_FORMATS_BY_LABEL.get(format)?.extension ?? format;
}

function getPandocOptions(quickPickLabel: string): string | undefined {
  if (!isSupportedFormat(quickPickLabel)) {
    return undefined;
  }
  return vscode.workspace
    .getConfiguration("pandoc")
    .get<string>(quickPickLabel + "OptString");
}

function openDocument(outFile: string) {
  switch (process.platform) {
    case "darwin":
      execFile("open", [outFile]);
      break;
    case "linux":
      execFile("xdg-open", [outFile]);
      break;
    default:
      execFile(outFile, []);
  }
}

function getPandocExecutablePath(): string {
  // By default the pandoc executable should be resolved from the PATH
  // environment variable, so fall back to the bare command name rather than
  // leaving it undefined (which would otherwise be stringified as the
  // literal text "undefined" and passed to execFile as the command).
  if (
    vscode.workspace.getConfiguration("pandoc").has("executable") &&
    vscode.workspace.getConfiguration("pandoc").get("executable") !== ""
  ) {
    return vscode.workspace
      .getConfiguration("pandoc")
      .get<string>("executable") as string;
  }
  return "pandoc";
}

function getLuaFilterPaths(extensionPath?: string): string[] {
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

  return filters;
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
    async (args?: { outputType: string }) => {
      // Workspace-controlled settings (executable, Docker options/image, Lua
      // filters, per-format flags) all feed into a spawned process below, so
      // this command must not run in an untrusted workspace. `package.json`
      // declares untrustedWorkspaces.supported: false as the primary guard;
      // this check defends the same path in case that declaration doesn't
      // apply (e.g. a future virtual-workspace or embedded host).
      if (!vscode.workspace.isTrusted) {
        vscode.window.showErrorMessage(
          "pandoc: this command requires a trusted workspace because it runs the Pandoc executable, Docker, and workspace-configured filters."
        );
        return;
      }

      var defaultFormat = getPandocDefaultFormat();
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      // Pandoc reads the file from disk, not the editor buffer, so an unsaved
      // edit would otherwise be silently ignored and the export would use
      // stale content.
      if (editor.document.isDirty) {
        const saved = await editor.document.save();
        if (!saved) {
          vscode.window.showErrorMessage(
            "pandoc: could not save the document before rendering. Save it manually and try again."
          );
          return;
        }
      }

      let fullName = path.normalize(editor.document.fileName);
      var filePath = path.dirname(fullName);
      var fileName = path.basename(fullName);
      var fileNameOnly = path.parse(fileName).name;

      var extensionPath = context.extensionPath;

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
        displayMenuAndRender(context, filePath, fileName, fileNameOnly, extensionPath);
      } else if (!isSupportedFormat(requestedFormat)) {
        // defaultFormat comes from a workspace-controlled setting; the manifest
        // enum is not a runtime guarantee, so it is re-checked here too.
        vscode.window.showErrorMessage(
          'pandoc: "' + requestedFormat + '" is not a supported output format. Check pandoc.defaultOutputFormat.'
        );
      } else {
        renderDoc(filePath, fileName, fileNameOnly, requestedFormat, extensionPath);
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

  let items: vscode.QuickPickItem[] = SUPPORTED_FORMATS.map((f) => ({ ...f }));

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
  var outExt = getOutputFileExtension(format);
  var outFile = path.join(filePath, fileNameOnly) + "." + outExt;

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
    pandocOutputChannel.append(message + "\n");
    return;
  }

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

  var luaFilterPaths = getLuaFilterPaths(extensionPath);

  // Build command and argument list safely without going through a shell.
  var command: string;
  var args: string[] = [];

  if (useDocker) {
    command = "docker";
    args = [
      "run",
      "--rm",
      // Hardened defaults: no network access, no Linux capabilities, and no
      // privilege escalation via setuid/setgid binaries inside the
      // container. `dockerOptions` is appended after these and can still
      // override them (e.g. a filter that genuinely needs network access),
      // but the workspace supplying that override must already be trusted
      // (see the Workspace Trust check above).
      "--network=none",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "-v",
      filePath + ":/data",
    ];
    // Mount each Lua filter into the container and rewrite paths
    luaFilterPaths.forEach((filterPath, i) => {
      var containerPath = "/filters/filter-" + i + ".lua";
      args.push("-v");
      args.push(filterPath + ":" + containerPath + ":ro");
    });
    if (dockerOptions) {
      args = args.concat(parseShellArgs(dockerOptions));
    }
    args.push(String(dockerImage));
    args.push(fileName);
    args.push("-o");
    args.push(fileNameOnly + "." + outExt);
    args.push("--to=" + format);
    if (pandocOptions) {
      args = args.concat(parseShellArgs(pandocOptions));
    }
    luaFilterPaths.forEach((_filterPath, i) => {
      args.push("--lua-filter");
      args.push("/filters/filter-" + i + ".lua");
    });
  } else {
    command = pandocExecutablePath;
    args.push(inFile);
    args.push("-o");
    args.push(outFile);
    args.push("--to=" + format);
    if (pandocOptions) {
      args = args.concat(parseShellArgs(pandocOptions));
    }
    luaFilterPaths.forEach((filterPath) => {
      args.push("--lua-filter");
      args.push(filterPath);
    });
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
