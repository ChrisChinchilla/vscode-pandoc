import * as vscode from "vscode";
import * as path from "path";
import { isSupportedFormat } from "./formats";
import { parseShellArgs } from "./commandBuilder";
import { log } from "./outputChannel";

export type PandocProfile = Record<string, string>;

const ACTIVE_PROFILE_STATE_KEY = "pandoc.activeProfile";

export function getPandocProfiles(): Record<string, PandocProfile> {
  const profiles = vscode.workspace
    .getConfiguration("pandoc")
    .get<Record<string, PandocProfile>>("profiles", {});
  return profiles && typeof profiles === "object" ? profiles : {};
}

/**
 * Resolves which profile (if any) is currently active for this workspace:
 * whatever was last chosen via "Pandoc: Select Profile", falling back to
 * `pandoc.defaultProfile` the first time (before anything has been chosen).
 * Either source is discarded if it no longer names a real profile, so a
 * renamed/removed profile silently reverts to unprofiled behavior rather
 * than erroring.
 */
export function getActiveProfileName(
  context: vscode.ExtensionContext
): string | undefined {
  const profiles = getPandocProfiles();
  // `null` records that the user explicitly selected "Default". Using
  // `undefined` for that choice would delete the Memento entry, making it
  // indistinguishable from a workspace where no choice has been made yet and
  // causing defaultProfile to become active again on the next render.
  const stored = context.workspaceState.get<string | null>(ACTIVE_PROFILE_STATE_KEY);
  if (stored === null) {
    return undefined;
  }
  if (stored !== undefined) {
    return stored in profiles ? stored : undefined;
  }
  const defaultProfile = vscode.workspace
    .getConfiguration("pandoc")
    .get<string>("defaultProfile", "");
  return defaultProfile && defaultProfile in profiles ? defaultProfile : undefined;
}

export async function setActiveProfileName(
  context: vscode.ExtensionContext,
  profileName: string | undefined
): Promise<void> {
  await context.workspaceState.update(ACTIVE_PROFILE_STATE_KEY, profileName ?? null);
}

export function getPandocOptions(
  quickPickLabel: string,
  profileName?: string
): string | undefined {
  if (!isSupportedFormat(quickPickLabel)) {
    return undefined;
  }
  const key = quickPickLabel + "OptString";
  if (profileName) {
    const profileValue = getPandocProfiles()[profileName]?.[key];
    if (profileValue !== undefined) {
      return profileValue;
    }
  }
  return vscode.workspace.getConfiguration("pandoc").get<string>(key);
}

export function getPandocExecutablePath(): string {
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

export function getLuaFilterPaths(extensionPath?: string): string[] {
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

// `pandoc.docker.options` used to be a single shell-like string, parsed with
// the same fragile ad-hoc tokenizer used for per-format option strings. It's
// now a structured `string[]` so the arguments Docker actually receives are
// explicit, individually visible in the Settings UI, and not dependent on
// `parseShellArgs`'s quoting/whitespace rules. Any legacy string value found
// in global, workspace, or folder settings is migrated in place (parsed once
// with `parseShellArgs`, then written back as an array under the same key),
// mirroring the `pandoc.useDocker` -> `pandoc.docker.enabled` migration below.
export function migrateDockerOptionsToArray(
  pandocConfigurations: vscode.WorkspaceConfiguration
): void {
  const inspected = pandocConfigurations.inspect<string | string[]>("docker.options");
  const scopes: [string, string | string[] | undefined, vscode.ConfigurationTarget][] = [
    ["global", inspected?.globalValue, vscode.ConfigurationTarget.Global],
    ["workspace", inspected?.workspaceValue, vscode.ConfigurationTarget.Workspace],
    ["folder", inspected?.workspaceFolderValue, vscode.ConfigurationTarget.WorkspaceFolder],
  ];

  for (const [scopeLabel, value, target] of scopes) {
    if (typeof value !== "string" || value.trim() === "") {
      continue;
    }
    const parsed = parseShellArgs(value);
    log(
      'migrating ' + scopeLabel + ' configuration "pandoc.docker.options" from a shell-like string to a structured array\n'
    );
    vscode.window.showWarningMessage(
      'pandoc: migrated the ' + scopeLabel + ' "pandoc.docker.options" setting from a single string to a structured list. Review it in Settings if the render behaves unexpectedly.'
    );
    pandocConfigurations.update("docker.options", parsed, target);
  }
}

// `pandoc.useDocker` was renamed to `pandoc.docker.enabled`. Any value found
// in global, workspace, or folder settings is copied to the new key and
// cleared from the old one, in the same shape as the docker.options
// migration above.
export function migrateUseDockerToDockerEnabled(
  pandocConfigurations: vscode.WorkspaceConfiguration
): void {
  const inspected = pandocConfigurations.inspect<boolean>("useDocker");
  const scopes: [string, boolean | undefined, vscode.ConfigurationTarget][] = [
    ["global", inspected?.globalValue, vscode.ConfigurationTarget.Global],
    ["workspace", inspected?.workspaceValue, vscode.ConfigurationTarget.Workspace],
    ["folder", inspected?.workspaceFolderValue, vscode.ConfigurationTarget.WorkspaceFolder],
  ];

  for (const [scopeLabel, value, target] of scopes) {
    if (value === undefined) {
      continue;
    }
    log(
      'migrating ' + scopeLabel + ' configuration "pandoc.useDocker" -> "pandoc.docker.enabled"\n'
    );
    vscode.window.showWarningMessage(
      'pandoc: found deprecated value in ' + scopeLabel + ' configuration. Migrating configuration "pandoc.useDocker" -> "pandoc.docker.enabled".'
    );
    pandocConfigurations.update("docker.enabled", value, target);
    pandocConfigurations.update("useDocker", undefined, target);
  }
}

export function getDockerOptions(pandocConfigurations: vscode.WorkspaceConfiguration): string[] {
  const raw = pandocConfigurations.get<string[]>("docker.options", []);
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((opt): opt is string => typeof opt === "string" && opt.trim() !== "");
}

export function getPandocDefaultFormat(): string | undefined {
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

/**
 * Resolves the output folder for a render operation.
 * Returns the folder path to use, or null if the user cancelled the prompt.
 * When no custom folder is configured or entered, returns the source file's directory.
 */
export async function resolveOutputFolder(
  sourceFilePath: string,
  profileName?: string
): Promise<string | null> {
  const profileFolder = profileName
    ? getPandocProfiles()[profileName]?.outputFolder
    : undefined;
  const configuredFolder =
    profileFolder ??
    vscode.workspace.getConfiguration("pandoc").get<string>("outputFolder", "");
  const promptForFolder = vscode.workspace
    .getConfiguration("pandoc")
    .get<boolean>("render.promptForOutputFolder", false);

  if (promptForFolder) {
    const defaultValue = configuredFolder || sourceFilePath;
    const result = await vscode.window.showInputBox({
      prompt: "Enter the output folder path for the rendered document",
      value: defaultValue,
      placeHolder: sourceFilePath,
    });
    if (result === undefined) {
      return null; // user cancelled
    }
    return result.trim() || sourceFilePath;
  }

  return configuredFolder.trim() || sourceFilePath;
}
