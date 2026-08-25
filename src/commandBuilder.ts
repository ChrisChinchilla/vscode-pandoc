export function parseShellArgs(input: string): string[] {
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

export interface BuildCommandParams {
  useDocker: boolean;
  inFile: string;
  fileName: string;
  fileNameOnly: string;
  filePath: string;
  outFolder: string;
  outFile: string;
  outExt: string;
  format: string;
  pandocExecutablePath: string;
  pandocOptions: string | undefined;
  inFileArgs: string[];
  /**
   * Extra directories (already delimiter-joined for the host OS) to pass as
   * `--resource-path`, so relative resource references (--css, images, etc.)
   * still resolve when they're relative to the workspace root rather than
   * this specific file's own directory. Docker mode ignores this: the
   * container only has the file's own directory bind-mounted, so a host path
   * outside it wouldn't resolve inside the container anyway.
   */
  resourcePathArg: string | undefined;
  /**
   * Path (host path locally, or a path resolvable inside the container in
   * Docker mode) to a `--reference-doc` template auto-detected by naming
   * convention, for formats where Pandoc supports one (docx, odt, pptx).
   * Added early in the argument list so an explicit `--reference-doc` in
   * pandocOptions or inFileArgs -- a single-value option, last one wins --
   * always overrides the auto-detected one rather than the reverse.
   */
  documentTemplateArg: string | undefined;
  dockerOptions: string[];
  dockerImage: string | undefined;
  luaFilterPaths: string[];
}

export interface CommandPlan {
  command: string;
  args: string[];
}

// Pure local/Docker argument construction: no vscode, child_process, or fs
// dependency, so this can be exercised directly with plain inputs.
export function buildCommand(params: BuildCommandParams): CommandPlan {
  const {
    useDocker,
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
  } = params;

  var command: string;
  var args: string[] = [];

  if (useDocker) {
    command = "docker";
    args = [
      "run",
      "--rm",
      // Hardened defaults: no network access, no Linux capabilities, no
      // privilege escalation via setuid/setgid binaries, and the source
      // directory is mounted read-only so the container can read the input
      // (and any relative resources beside it) but cannot write into it.
      // Output always goes through a separate `/output` mount instead, even
      // when it resolves to the same host directory as the input (the
      // no-custom-output-folder case) -- Docker allows bind-mounting the
      // same host path at two container paths with different permissions,
      // so the container still can't write back into the read-only `/data`
      // tree; it can only write through the dedicated writable mount.
      // `dockerOptions` is appended after these and can still override them
      // (e.g. a filter that genuinely needs network access), but the
      // workspace supplying that override must already be trusted (see the
      // Workspace Trust check in commands.ts).
      "--network=none",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "-v",
      filePath + ":/data:ro",
      "-v",
      outFolder + ":/output",
    ];
    // Mount each Lua filter into the container and rewrite paths
    luaFilterPaths.forEach((filterPath, i) => {
      var containerPath = "/filters/filter-" + i + ".lua";
      args.push("-v");
      args.push(filterPath + ":" + containerPath + ":ro");
    });
    args = args.concat(dockerOptions);
    args.push(String(dockerImage));
    args.push(fileName);
    args.push("-o");
    args.push("/output/" + fileNameOnly + "." + outExt);
    args.push("--to=" + format);
    if (documentTemplateArg) {
      args.push("--reference-doc=" + documentTemplateArg);
    }
    if (pandocOptions) {
      args = args.concat(parseShellArgs(pandocOptions));
    }
    // In-file args are appended after pandocOptions so they can override the
    // workspace-configured OptString, matching pandoc's own last-flag-wins
    // behavior for repeated options.
    args = args.concat(inFileArgs);
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
    if (documentTemplateArg) {
      args.push("--reference-doc=" + documentTemplateArg);
    }
    if (resourcePathArg) {
      args.push("--resource-path=" + resourcePathArg);
    }
    if (pandocOptions) {
      args = args.concat(parseShellArgs(pandocOptions));
    }
    args = args.concat(inFileArgs);
    luaFilterPaths.forEach((filterPath) => {
      args.push("--lua-filter");
      args.push(filterPath);
    });
  }

  return { command, args };
}
