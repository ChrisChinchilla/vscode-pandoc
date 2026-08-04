# Project Audit Findings and Improvement Plan

## Highest-priority findings

| Priority | Finding | Impact | Status |
|---|---|---|---|
| Critical | Output can resolve to the input path, such as Markdown → GFM/CommonMark | Potential source-file truncation or overwrite | ✅ Fixed — `renderDoc` in `src/extension.ts` now resolves both paths and aborts with an error (no `execFile` call) when input and output collide, comparing case-insensitively on macOS/Windows |
| High | Formats supplied through command arguments are not runtime-validated | Path manipulation and unsupported execution paths | ✅ Fixed — added `SUPPORTED_FORMATS`/`isSupportedFormat` allowlist in `src/extension.ts`; `args.outputType` and `pandoc.defaultOutputFormat` are both checked against it before use, rejecting unknown formats with an error message |
| High | Workspace-controlled executable, Docker, filter, and option settings influence process execution | Requires explicit Workspace Trust protection | ✅ Fixed — `package.json` declares `capabilities.untrustedWorkspaces.supported: false`, and the `pandoc.render` command handler in `src/extension.ts` also checks `vscode.workspace.isTrusted` defensively and refuses to run with an error if untrusted |
| High | Docker accepts unrestricted flags and defaults to `pandoc/latex:latest` | Host access and supply-chain exposure | ✅ Fixed — `pandoc.docker.image` defaults to a pinned, reviewed tag (`pandoc/latex:3.10.0.0-ubuntu`); every Docker run includes `--network=none`, `--cap-drop=ALL`, and `--security-opt=no-new-privileges`; the source directory is now mounted `:ro`; and output always goes through a separate `-v <outFolder>:/output` mount rather than writing back into the source mount, even when no custom output folder is configured (Docker allows the same host path to be bind-mounted at two container paths with independent permissions, so the container still can't write into `/data` even when `/output` happens to resolve to the same directory). `docker.options` is still appended after these and can override them — that's judged acceptable now that it requires a trusted workspace |
| High | Seven vulnerable development dependencies | Five high, one moderate, one low; release/CI risk | ✅ Fixed — `npm audit fix` resolved 4 of 7 (`brace-expansion`, `fast-uri`, `js-yaml`, `picomatch`); the remaining 3 were transitive deps bundled inside `mocha` (`diff`, `serialize-javascript`) with no compatible mocha release yet, so `package.json` now pins them via `overrides` to patched versions (`diff@^9.0.0`, `serialize-javascript@^7.0.7`). `npm audit` now reports 0 vulnerabilities |
| High | Release workflow still runs Node 16 despite requiring Node ≥20.9 | Unreliable or broken releases | ✅ Fixed — `.github/workflows/publishTags.yml` now uses Node 22, matching `ci.yml` and `build.yaml` and satisfying the `engines.node: >=20.9.0` requirement in `package.json` |
| Medium | Unsaved editor contents are ignored | Export can silently use stale disk content | ✅ Fixed — a dirty document is saved only after a valid format is confirmed, immediately before rendering; failed saves abort, while invalid formats and a cancelled picker leave the document untouched |
| Medium | Integration tests cannot currently run and 14 tests are placeholders | False confidence in important behavior | ✅ Fixed — upgraded `@vscode/test-electron`, updated the `glob` API, replaced the original placeholders, and replaced three later-discovered output-channel existence checks with assertions that execute the production render/migration paths. The expanded full suite now passes: **87 passing, 0 failing** |
| Medium | Settings and format definitions are duplicated throughout the project | High maintenance cost and schema drift | 🟡 Partially fixed — `SUPPORTED_FORMATS` in `src/extension.ts` is now a single catalogue (label, description, extension) driving the quick pick, the format allowlist, and the extension lookup; the 29-case `getPandocOptions` switch was replaced with one lookup (`<label>OptString`, a naming pattern that held for every existing format). The 29 individual `pandoc.<format>OptString` entries in `package.json`'s configuration schema are **not** deduplicated — VS Code's configuration contribution point requires each setting to be individually declared, so collapsing those still needs the larger `formats.ts`/settings-redesign work described below |

### Security and correctness

The output path is calculated directly from the input basename and selected extension in `src/extension.ts`. Formats such as `gfm` and `commonmark` map back to `.md`, so exporting `document.md` can target `document.md` itself. HTML → HTML has the same issue.

The command also accepts an arbitrary `outputType`, while unknown formats are used as output extensions. A strict runtime allowlist is required—manifest enums are not a security boundary.

Process invocation correctly uses `execFile` without a shell, which is a strong existing safeguard. However:

- `pandoc.executable`, Docker options, Docker images, Lua filters, and Pandoc flags can all be workspace-controlled.
- Docker options can grant capabilities, mounts, networking, or host access.
- The default mutable `latest` image tag makes builds non-reproducible.
- Local child processes inherit the extension host environment.
- `execFile` still buffers output in memory up to its limit. Cancellation and a configurable timeout are now supplied through Node's `AbortSignal` and `timeout` options. See the [Node child-process documentation](https://nodejs.org/api/child_process.html).

The extension now explicitly declares itself unsupported in untrusted workspaces and checks trust defensively before rendering because it executes workspace files and workspace-influenced commands. This is the scenario covered by [VS Code’s Workspace Trust guidance](https://code.visualstudio.com/api/extension-guides/workspace-trust).

Recommended changes:

- [x] Explicitly require Workspace Trust and reject execution defensively when untrusted.
- [x] Validate formats against one immutable catalogue.
- [x] Detect input/output collisions and require a different path.
- [x] Prompt before replacing an existing output, offering Overwrite or cancellation.
- [x] Save dirty documents only after format confirmation and provide cancellable rendering through a progress notification and `AbortSignal`.
- [x] Require local `file:` documents, reject untitled documents, and declare virtual workspaces unsupported.
- [x] Replace platform-specific `open`/`xdg-open` execution with `vscode.env.openExternal`.
- [x] Pin the default Docker image to a reviewed version.
- [x] Harden Docker defaults with read-only input mounts, isolated output, no network, dropped capabilities, and `no-new-privileges`.
- [x] Validate or replace free-form Docker option strings with structured argument arrays. `pandoc.docker.options` is now a `string[]` setting rather than a shell-like string; a legacy string value in any settings scope is migrated in place (parsed once, rewritten as an array, one-time warning) the same way `pandoc.useDocker` is migrated.
- [x] Show concise errors and keep detailed output in the local output channel. `renderDoc` in `src/extension.ts` now shows a short popup ("...rendering failed/produced warnings. See the Pandoc output channel for details.") instead of dumping raw stderr/exec-error text into `showErrorMessage`; the full stdout, `stderr: ...`, and `exec error: ...` text still goes to the Pandoc output channel unchanged. Non-fatal stderr (pandoc exits successfully but still wrote warnings) now surfaces as `showWarningMessage`, not `showErrorMessage`, and a real failure that also produced stderr output no longer stacks two popups.

### Review follow-up (2026-08-03)

Pre-merge items identified during review:

- [x] Defer saving a dirty document until after runtime format validation and quick-pick confirmation, so invalid arguments and picker cancellation have no save side effect.
- [x] Replace the three ineffective output-channel tests with production-path assertions for stdout, stderr, and migration logging. Output-channel creation now happens during activation and the channel is registered for disposal.
- [x] Reconcile this audit with the implementation already present in the draft commit and remove stale dependency/status claims.

Recommended subsequent work:

- [x] Prompt before overwriting an existing output file. The modal prompt offers Overwrite or cancellation.
- [x] Reject untitled and non-`file:` documents explicitly before showing the format picker, saving, or invoking Pandoc.
- [x] Replace platform-specific `open`/`xdg-open` execution with `vscode.env.openExternal`.
- [x] Make rendering awaitable and add cancellable progress, a configurable timeout (`pandoc.render.timeout`, 300 seconds by default and `0` to disable), and same-destination concurrent-output rejection.
- [x] Replace unrestricted Docker option strings with structured arguments, or document hardened defaults as user-overridable rather than guaranteed. Done via the `docker.options` array migration above; the README's Docker Options section also documents that these entries are appended after (and can override) the hardened defaults.
- [ ] Split `extension.ts` into format, configuration, command-building, rendering, and VS Code interaction modules.
- [ ] Add genuine coverage reporting; `test:coverage` currently only reruns the suite.
- [ ] Give release workflows minimal permissions, pin actions to reviewed commit SHAs, and publish one tested VSIX artifact to both registries.
- [ ] Improve collision detection for case-sensitive macOS volumes and filesystem aliases rather than assuming every Darwin filesystem is case-insensitive.

## Settings-first UI improvements

All settings currently sit in one long “Pandoc options” group, with 29 format-option fields appearing before common behavior controls in `package.json`.

Recommended Settings UI categories:

1. **Pandoc: General**
   - Executable
   - Default output format
   - Open output after export
2. **Pandoc: Format Picker**
   - Sort by frequency
   - Future favorites/recent-formats controls
3. **Pandoc: Format Options**
   - The 29 format-specific settings, consistently named and ordered
4. **Pandoc: Filters**
   - Lua filters
   - Admonitions
5. **Pandoc: Docker**
   - Enabled
   - Image
   - Structured options
   - Security explanation

VS Code supports configuration categories, ordering, scope, and Markdown descriptions for this purpose. See the [configuration contribution documentation](https://code.visualstudio.com/api/references/contribution-points?from=20423).

Other UI improvements:

- [ ] Rename the command to `Pandoc: Export Document`.
- [ ] Add `Pandoc: Export Document As…` so the default format can be overridden without editing settings.
- [ ] Give the picker a title, placeholder, friendly labels, file extensions, and recent/favorite sections.
- [ ] Add editor-title and context-menu actions with consistent language conditions.
- [x] Replace the generating status message with a cancellable progress notification. A short launching status remains when opening successful output.
- [ ] Offer “Open Output” and “Show Log” actions on completion or failure.
- [x] Warn when no editor is available instead of silently returning. `pandoc.render` now calls `showWarningMessage("pandoc: no active editor. Open a document to render it.")` before returning when `vscode.window.activeTextEditor` is undefined.
- [x] Fix the keybinding language condition, which currently covers only Markdown and reStructuredText despite broader activation. The default `ctrl+K P`/`cmd+K P` keybinding's `when` clause in `package.json` now lists all six languages already declared in `activationEvents` (markdown, asciidoc, xml, html, epub, restructuredtext) instead of just markdown/restructuredtext.
- [x] Correct the README’s obsolete `pandoc.defaultFormat` reference; the actual key is `pandoc.defaultOutputFormat`. Also corrected the keybinding example, which referenced a nonexistent `pandoc.export` command and `format` argument instead of the real `pandoc.render` command and `outputType` argument.

## Efficiency and code structure

The 558-line entry point repeats the same format information in:

- The settings schema
- A 29-case configuration switch
- The picker
- The output-extension map
- Tests and documentation

Create a single typed format catalogue containing ID, label, extension, option key, description, and default arguments. Runtime behavior, picker items, and tests should derive from it. **Partially done**: `SUPPORTED_FORMATS` in `src/extension.ts` now unifies label, description, and extension, and drives the picker, the allowlist, and the extension lookup; the per-format option key is derived by convention (`<label>OptString`) rather than stored explicitly, and default arguments aren't part of the catalogue yet. Splitting this into a standalone `formats.ts` module (and the rest of the module breakdown below) is still open.

Suggested modules:

- `formats.ts` — canonical format definitions and validation
- `configuration.ts` — typed configuration and one-time migrations
- `commandBuilder.ts` — pure local/Docker argument construction
- `renderer.ts` — process lifecycle, cancellation, logging
- `commands.ts` — VS Code interaction
- `extension.ts` — activation and disposal only

Additional efficiency improvements:

- [ ] Remove broad language activation. Because the command is contributed and the extension targets a modern VS Code version, VS Code can activate it when invoked. This avoids loading the extension merely because an HTML or Markdown file is opened. See the [activation-event documentation](https://code.visualstudio.com/api/references/activation-events).
- [ ] Replace buffered `execFile` execution with streamed `spawn`.
- [ ] Read configuration once per export.
- [ ] Perform deprecated-setting migration once during activation rather than every render.
- [~] Await rendering so process completion, output opening, and destination-lock cleanup are handled. Deprecated-setting migrations are still not awaited.
- [x] Dispose the output channel through `context.subscriptions`.
- [x] Prevent duplicate concurrent exports for the same destination by rejecting the later request with a warning.
- [ ] Consolidate the duplicate CI and build workflows.

## Dependencies and release pipeline

Current production dependency audit: **zero vulnerabilities**.

Full development-tree audit: **zero vulnerabilities** (fixed — was 5 high, 1 moderate, 1 low, 0 critical). `npm audit fix` resolved `brace-expansion`, `fast-uri`, `js-yaml`, and `picomatch`. The remaining three (`diff`, `mocha`'s own dependency on it, and `serialize-javascript`) are bundled inside the installed `mocha` release with no fixed mocha version yet published, so they're pinned directly via an `overrides` block in `package.json`.

Proposed updates:

- [ ] VS Code types `1.110.0` → `1.125.0`
- [x] `@vscode/test-electron` `2.5.2` → `3.1.0`
- [ ] TypeScript `6.0.2` → `7.0.2`
- [ ] Node types `25.5.0` → `26.1.2`
- [ ] Sinon `21.0.3` → `22.1.0`
- [ ] Webpack `5.105.4` → `5.109.2`
- [ ] Webpack CLI `7.0.2` → `7.2.2`
- [ ] ts-loader `9.5.4` → `9.6.2`
- [ ] Mocha `11.7.5` → `11.7.6`
- [ ] Remove deprecated TSLint and migrate to ESLint.
- [ ] Add `@vscode/vsce` locally instead of installing an unpinned global CLI.
- [ ] Add genuine coverage tooling; `test:coverage` currently only reruns `npm test`.

CI/release changes:

- [x] Move CI and publishing to the current Node release. `publishTags.yml` was still on Node 16; bumped to Node 22 to match `ci.yml`/`build.yaml` and the `engines.node: >=20.9.0` requirement.
- [ ] Replace obsolete CodeQL v2 with v4. GitHub identifies v4 as the current line. See the [CodeQL migration guidance](https://github.blog/changelog/2025-10-28-upcoming-deprecation-of-codeql-action-v3/).
- [ ] Pin third-party actions to reviewed full commit SHAs. See [GitHub security guidance](https://docs.github.com/en/enterprise-cloud%40latest/code-security/tutorials/secure-your-organization/protect-against-threats).
- [ ] Add minimal workflow permissions.
- [ ] Build one validated VSIX and publish that same artifact to both registries.
- [ ] Add lint, audit, package-content, and coverage checks.
- [ ] Exclude the unused 3.26 MB GIF and other development files from the VSIX.

## Test assessment

TypeScript compilation, test compilation, and the existing TSLint check pass.

**Update**: both runner issues are fixed. The integration suite previously couldn't run because `@vscode/test-electron@2.5.2` did not recognize the newer macOS executable name; bumping to `3.1.0` fixed detection. The suite loader was also updated from the removed callback-style `glob()` API to the Promise-based `{ glob }` export. The original placeholder assertions were replaced with behavioral checks. A subsequent review found three output-channel tests that still only checked whether a mock method existed; these now execute rendering or migration and assert the exact logged content.

**Update (2026-08-04)**: `npm run test-compile` failed with `error TS5103: Invalid value for '--ignoreDeprecations'` at the start of this session — unrelated to any code change. `node_modules/typescript` had drifted to `5.9.2` while `package.json`/`package-lock.json` already pinned `^6.0.2`/`6.0.2` (the `ignoreDeprecations: "6.0"` in `tsconfig.test.json` is invalid under 5.9). A plain `npm install` resynced `node_modules` to the already-committed lockfile versions (no `package.json`/lockfile changes); `npm audit` still reports 0 vulnerabilities afterward.

Current verification result (2026-08-04): **88 passing, 0 failing** in the VS Code Extension Host. TypeScript compilation, TSLint, and test compilation also pass.

Recommended test work:

- [x] Add pure unit tests for format validation, paths, argument parsing, collision prevention, and command construction. (`Input/Output Collision Guard Tests`, `Command Arguments Tests` in `test/suites/extension.test.ts`)
- [x] Add process-adapter tests for success, stderr warnings, cancellation, timeout, and failure.
- [x] Add Workspace Trust tests. (`should refuse to render in an untrusted workspace`)
- [x] Add dirty, untitled, and virtual-document tests.
- [x] Add Docker hardening tests. (`should apply hardened Docker defaults...`, `should mount the source directory read-only and route output through a separate /output mount`, `user-supplied dockerOptions should be appended after the hardened defaults`, `should migrate a legacy global/workspace docker.options string to a structured array`, `should not touch docker.options when it is already a structured array`)
- [x] Replace placeholder assertions with tests of production behavior. All 13 remaining `assert.ok(true)` placeholders in `test/suites/extension.test.ts` were replaced with assertions against actual `execFile` args, `showErrorMessage`/`showWarningMessage` calls, and config `update()` calls.
- [ ] Add a smaller genuine Extension Host integration suite.
- [ ] Add Lua-filter fixtures for escaping and each supported renderer.
- [x] Repair or replace the incomplete cached VS Code test installation. The cache wasn't actually corrupted — `@vscode/test-electron@2.5.2` didn't know that newer VS Code downloads rename `Contents/MacOS/Electron` to `Contents/MacOS/Code` on macOS, so it failed to launch. Bumped to `3.1.0`. A separate real bug was found alongside it: `test/suites/index.js` used the removed callback-style `glob()` API (fixed for `glob@13`'s Promise-based `{ glob }` export). With both fixed, `npm test` runs the full suite (currently 87 passing) in a normal environment.

## Proposed implementation order

1. [x] Prevent output collisions, validate formats, enforce trust, prompt before replacement, require local saved documents, save dirty content after confirmation, and use `vscode.env.openExternal`.
2. [ ] Introduce the typed format catalogue and modular renderer architecture.
3. [ ] Reorganize settings and improve commands, picker, progress, and messages.
4. [x] Harden Docker and process execution. Pinned image, restricted container defaults, read-only input mount, isolated output mount, structured (and migrated) `docker.options`, process cancellation, timeout, and destination concurrency protection are all done.
5. [~] Upgrade dependencies, replace TSLint, and repair tests/coverage. Vulnerabilities are resolved (`npm audit`: 0); the version-bump list and the TSLint→ESLint migration are still open.
6. [~] Consolidate and secure CI/release workflows. `publishTags.yml` moved off Node 16. The remaining CI/release hardening items (CodeQL v4, SHA-pinned actions, workflow permissions, single validated VSIX, consolidating `ci.yml`/`build.yaml`) are still open — see the CI/release changes list above.
7. [~] Rebuild the extension bundle and verify compile, lint, unit tests, integration tests, audit, and VSIX contents. The production bundle was regenerated successfully; compile, lint, the Extension Host suite, and a fresh dependency audit pass. VSIX-content inspection remains.

## Implementation status

Implementation is in progress in the current draft. The completed items are marked above. The tracked `dist/extension.js` was regenerated in production mode after the source changes and webpack completed successfully.
