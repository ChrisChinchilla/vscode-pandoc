# Project Audit Findings and Improvement Plan

## Reconciliation (2026-09-16)

This audit was reconciled against the checked-in source, manifest, lockfile, workflows, tests, and the output of `vsce ls`. The implementation is authoritative when an older narrative note conflicts with the current repository. After completing the reconciled partial items, the detailed checklists contain **16 open** and **0 partially complete** entries; the implementation-order checklist at the end only summarizes that work and is not an additional set of items.

Current verification:

- `npm run compile` and `npm run lint` pass.
- `npm audit` reports **0 vulnerabilities** across 497 dependencies.
- `vsce ls` confirms that package-content cleanup remains open: the package includes the 3.1 MB demo GIF, `.github/`, `PROJECT_AUDIT.md`, `tslint.json`, `tsconfig.test.json`, `.claude/notes` and release skills, `out/src`, and the runtime `js-yaml`/`argparse` files. The older note about `.claude/settings.local.json` is no longer applicable because that file is not present or packaged.
- The full VS Code 1.138.0 Extension Host suite passes: **137 passing, 0 failing**, including eight real-Pandoc Lua-filter integration tests. The launchers now remove an inherited `ELECTRON_RUN_AS_NODE` value before starting the desktop test application, preventing VS Code-hosted test commands from accidentally launching it in Node mode.
- Dependency versions now already meet or exceed the former Node types, Sinon, Webpack, Webpack CLI, `ts-loader`, and Mocha targets. The VS Code types, TypeScript 7, and TSLint-to-ESLint work remains open.
- All workflows now declare minimal permissions and use SHA-pinned external actions. TODO automation is pinned to v5, and CodeQL is pinned to the v4 line.
- Stable and prerelease publishing are gated by reusable CI. CI packages one channel-appropriate `vscode-pandoc.vsix`, and both registry steps consume that exact downloaded artifact.

## Highest-priority findings

| Priority | Finding | Impact | Status |
|---|---|---|---|
| Critical | Output can resolve to the input path, such as Markdown → GFM/CommonMark | Potential source-file truncation or overwrite | ✅ Fixed — `renderDoc` in `src/renderer.ts` resolves both paths and aborts before `execFile` when input and output collide, comparing case-insensitively on macOS/Windows |
| High | Formats supplied through command arguments are not runtime-validated | Path manipulation and unsupported execution paths | ✅ Fixed — `SUPPORTED_FORMATS`/`isSupportedFormat` in `src/formats.ts` drives validation in `src/commands.ts`; `args.outputType` and `pandoc.defaultOutputFormat` are checked before use |
| High | Workspace-controlled executable, Docker, filter, and option settings influence process execution | Requires explicit Workspace Trust protection | ✅ Fixed — `package.json` declares `capabilities.untrustedWorkspaces.supported: false`, and `handleRenderCommand` in `src/commands.ts` also refuses execution in an untrusted workspace |
| High | Docker accepts unrestricted flags and defaults to `pandoc/latex:latest` | Host access and supply-chain exposure | ✅ Fixed — `pandoc.docker.image` defaults to a pinned, reviewed tag (`pandoc/latex:3.10.0.0-ubuntu`); every Docker run includes `--network=none`, `--cap-drop=ALL`, and `--security-opt=no-new-privileges`; the source directory is now mounted `:ro`; and output always goes through a separate `-v <outFolder>:/output` mount rather than writing back into the source mount, even when no custom output folder is configured (Docker allows the same host path to be bind-mounted at two container paths with independent permissions, so the container still can't write into `/data` even when `/output` happens to resolve to the same directory). `docker.options` is still appended after these and can override them — that's judged acceptable now that it requires a trusted workspace |
| High | Seven vulnerable development dependencies | Five high, one moderate, one low; release/CI risk | ✅ Fixed — dependency updates and the retained `diff`/`serialize-javascript` overrides resolve the original findings; `npm audit` was rerun on 2026-09-16 and reports 0 vulnerabilities |
| High | Release workflow still runs Node 16 despite requiring Node ≥20.9 | Unreliable or broken releases | ✅ Fixed — publishing and CI use Node 22, satisfying the `engines.node: >=20.9.0` requirement; the duplicate `build.yaml` workflow was removed |
| Medium | Unsaved editor contents are ignored | Export can silently use stale disk content | ✅ Fixed — a dirty document is saved only after a valid format is confirmed, immediately before rendering; failed saves abort, while invalid formats and a cancelled picker leave the document untouched |
| Medium | Integration tests could not run and 14 tests were placeholders | False confidence in important behavior | ✅ Fixed — upgraded `@vscode/test-electron`, updated the `glob` API, normalized the test-launch environment, and replaced the placeholders and ineffective output-channel checks. The expanded suite passes 137/137 under VS Code 1.138.0 |
| Medium | Settings and format definitions are duplicated throughout the project | High maintenance cost and schema drift | ✅ Fixed to the extent allowed by VS Code's static manifest — `SUPPORTED_FORMATS` in `src/formats.ts` now owns label, description, extension, option key, default arguments, and reference-document support. Runtime behavior derives from it, and a test verifies that every required explicit `package.json` setting exists with the same default |

### Security and correctness

The output path is calculated directly from the input basename and selected extension in `src/renderer.ts`. Formats such as `gfm` and `commonmark` map back to `.md`, so exporting `document.md` can target `document.md` itself. HTML → HTML has the same issue. The collision guard now blocks those exact-path cases; filesystem aliases and volume-specific case behavior remain open below.

The original command accepted an arbitrary `outputType`, while unknown formats were used as output extensions. The runtime allowlist now closes that path; manifest enums alone would not have been a security boundary.

Process invocation correctly uses `execFile` without a shell, which is a strong existing safeguard. However:

- `pandoc.executable`, Docker options, Docker images, Lua filters, and Pandoc flags can all be workspace-controlled.
- Docker options can grant capabilities, mounts, networking, or host access.
- The original mutable `latest` image tag made builds non-reproducible; the current default is pinned.
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
- [x] Use a safe cross-platform output opener. The implementation deliberately invokes the OS opener with the output path passed as data to preserve non-ASCII filenames and avoid Windows PowerShell injection, with `vscode.env.openExternal` as a fallback.
- [x] Pin the default Docker image to a reviewed version.
- [x] Harden Docker defaults with read-only input mounts, isolated output, no network, dropped capabilities, and `no-new-privileges`.
- [x] Validate or replace free-form Docker option strings with structured argument arrays. `pandoc.docker.options` is now a `string[]` setting rather than a shell-like string; a legacy string value in any settings scope is migrated in place (parsed once, rewritten as an array, one-time warning) the same way `pandoc.useDocker` is migrated.
- [x] Show concise errors and keep detailed output in the local output channel. `renderDoc` in `src/renderer.ts` shows a short popup ("...rendering failed/produced warnings. See the Pandoc output channel for details.") instead of dumping raw stderr/exec-error text into `showErrorMessage`; the full stdout, `stderr: ...`, and `exec error: ...` text still goes to the Pandoc output channel unchanged. Non-fatal stderr surfaces as a warning, and a real failure that also produced stderr no longer stacks two popups.

### Review follow-up (2026-08-03)

Pre-merge items identified during review:

- [x] Defer saving a dirty document until after runtime format validation and quick-pick confirmation, so invalid arguments and picker cancellation have no save side effect.
- [x] Replace the three ineffective output-channel tests with production-path assertions for stdout, stderr, and migration logging. Output-channel creation now happens during activation and the channel is registered for disposal.
- [x] Reconcile this audit with the implementation already present in the draft commit and remove stale dependency/status claims.

Recommended subsequent work:

- [x] Prompt before overwriting an existing output file. The modal prompt offers Overwrite or cancellation.
- [x] Reject untitled and non-`file:` documents explicitly before showing the format picker, saving, or invoking Pandoc.
- [x] Replace unsafe platform-specific output opening. The current opener is intentionally platform-specific for filename compatibility, but uses `execFile`/environment data rather than shell interpolation and falls back to `vscode.env.openExternal`.
- [x] Make rendering awaitable and add cancellable progress, a configurable timeout (`pandoc.render.timeout`, 300 seconds by default and `0` to disable), and same-destination concurrent-output rejection.
- [x] Replace unrestricted Docker option strings with structured arguments, or document hardened defaults as user-overridable rather than guaranteed. Done via the `docker.options` array migration above; the README's Docker Options section also documents that these entries are appended after (and can override) the hardened defaults.
- [x] Split `extension.ts` into format, configuration, command-building, rendering, and VS Code interaction modules. See the "Suggested modules" list under "Efficiency and code structure" below for the final layout and the one deliberate addition (`outputChannel.ts`) beyond what was originally proposed here.
- [x] Add genuine coverage reporting; `test:coverage` currently only reruns the suite. See "Coverage reporting (2026-08-04)" under Test assessment below for the tool choice, why the multi-process test setup here needed it, and current numbers.
- [x] Give workflows minimal permissions, pin actions to reviewed commit SHAs, and publish one validated VSIX artifact to both registries. TODO automation is pinned to v5 with `contents: read` and `issues: write`; CodeQL is on the pinned v4 line; and stable/prerelease publishing downloads the single channel-appropriate VSIX produced by reusable CI and passes it to both registries.
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

The entry point used to be a single 663-line file repeating the same format information across the settings schema, a 29-case configuration switch, the picker, the output-extension map, and tests/documentation.

The typed format catalogue now contains label, extension, option key, description, default arguments, and reference-document support. Runtime behavior and picker items derive from it. VS Code still requires every setting to be declared explicitly in `package.json`, so a manifest-consistency test verifies that each catalogue option key exists there with the same default rather than allowing the two representations to drift.

**Done (2026-08-04)**: `extension.ts` was split into modules without requiring changes to the then-existing tests (they called the unchanged `activate()` entry point, so relocating internals was transparent to them):

- `src/formats.ts` — canonical format definitions and validation. No dependency on `vscode` or any other project module.
- `src/outputChannel.ts` — *(the one addition beyond the original proposal below)* owns the `vscode.OutputChannel` (`initOutputChannel()`, `log()`). Split out as its own leaf module because both `configuration.ts` (migration warnings) and `renderer.ts` (render logging) need to write to it, and `renderer.ts` already depends on `configuration.ts` for config reads — putting logging in either of those two would have created a circular import.
- `src/configuration.ts` — typed configuration reads and the two one-time migrations (`migrateDockerOptionsToArray`, and the new `migrateUseDockerToDockerEnabled`, extracted from three near-identical inline global/workspace/folder blocks into one loop matching its sibling's existing pattern).
- `src/commandBuilder.ts` — `parseShellArgs()` and the new pure `buildCommand()`, extracted from the local/Docker argument-construction block that used to be inline in `renderDoc()`. Takes only primitives, no `vscode`/`child_process`/`fs` — genuinely unit-testable in isolation.
- `src/renderer.ts` — `renderDoc()` (collision guard, concurrency guard, overwrite prompt, cancellable/timeout-wrapped `execFile`, logging, viewer launch), plus `setStatusBarText()`/`openDocument()` since they're only used from here.
- `src/commands.ts` — VS Code interaction glue: the exported `handleRenderCommand()` (the former inline command-registration callback body), `displayMenuAndRender()`, `saveAndRender()`.
- `src/extension.ts` — trimmed to just `activate()`: creates the output channel, registers `pandoc.render`, wires disposables. Nothing else.

Dependency direction (no cycles): `formats.ts`/`outputChannel.ts` are leaves; `configuration.ts` → `formats.ts`, `commandBuilder.ts`; `commandBuilder.ts` → `formats.ts` only; `renderer.ts` → `configuration.ts`, `commandBuilder.ts`, `formats.ts`, `outputChannel.ts`; `commands.ts` → `formats.ts`, `configuration.ts`, `renderer.ts`; `extension.ts` → `outputChannel.ts`, `commands.ts`. `dist/extension.js` was rebuilt via `npx webpack --mode production` against the new layout and bundles clean.

Additional efficiency improvements:

- [ ] Remove broad language activation. Because the command is contributed and the extension targets a modern VS Code version, VS Code can activate it when invoked. This avoids loading the extension merely because an HTML or Markdown file is opened. See the [activation-event documentation](https://code.visualstudio.com/api/references/activation-events).
- [ ] Replace buffered `execFile` execution with streamed `spawn`.
- [ ] Read configuration once per export.
- [ ] Perform deprecated-setting migration once during activation rather than every render.
- [x] Await the render process and release destination locks on completion. Output opening is intentionally detached so long-lived desktop viewers do not hold the render lock; launch failures are caught asynchronously. Deprecated-setting updates remain unawaited and are tracked by the migration item above.
- [x] Dispose the output channel through `context.subscriptions`.
- [x] Prevent duplicate concurrent exports for the same destination by rejecting the later request with a warning.
- [x] Consolidate the duplicate CI and build workflows. `.github/workflows/build.yaml` was a byte-for-byte duplicate of `ci.yml`'s `build` job (same checkout/setup-node/install/compile/package steps); deleted it and kept `ci.yml`'s version, which already gates on the `test` job and uploads the VSIX artifact.

## Dependencies and release pipeline

Current production dependency audit: **zero vulnerabilities**.

Full development-tree audit: **zero vulnerabilities** as reverified on 2026-09-16 (fixed — was 5 high, 1 moderate, 1 low, 0 critical). The lockfile is current and `package.json` retains patched `diff` and `serialize-javascript` overrides.

Proposed updates:

- [ ] VS Code types `1.110.0` → `1.125.0`
- [x] `@vscode/test-electron` `2.5.2` → `3.1.0`
- [ ] TypeScript `6.0.2` → `7.0.2`
- [x] Node types `25.5.0` → `26.1.2` (currently `^26.4.1`)
- [x] Sinon `21.0.3` → `22.1.0` (currently `^22.1.0`)
- [x] Webpack `5.105.4` → `5.109.2` (currently `^5.110.3`)
- [x] Webpack CLI `7.0.2` → `7.2.2` (currently `^7.2.3`)
- [x] ts-loader `9.5.4` → `9.6.2` (currently `^9.6.2`)
- [x] Mocha `11.7.5` → `11.7.6` (currently `^12.0.0`)
- [ ] Remove deprecated TSLint and migrate to ESLint.
- [x] Add `@vscode/vsce` locally instead of installing an unpinned global CLI. It is a devDependency and `ci.yml` packages with the local `npm run package` script; publishing uses the pinned `HaaLeo/publish-vscode-extension` action's packaging path rather than a global VSCE install.
- [x] Add genuine coverage tooling; `test:coverage` currently only reruns `npm test`. Done via `c8` — see "Coverage reporting (2026-08-04)" under Test assessment below.

CI/release changes:

- [x] Move CI and publishing off Node 16. Publishing and CI now use Node 22 and satisfy the `engines.node: >=20.9.0` requirement.
- [x] Upgrade CodeQL from v3.37.8 to a SHA-pinned v4 action. See the [CodeQL migration guidance](https://github.blog/changelog/2025-10-28-upcoming-deprecation-of-codeql-action-v3/).
- [x] Pin third-party actions to reviewed full commit SHAs. TODO automation was upgraded from the floating v4 tag to a pinned v5 commit. See [GitHub security guidance](https://docs.github.com/en/enterprise-cloud%40latest/code-security/tutorials/secure-your-organization/protect-against-threats).
- [x] Add minimal workflow permissions. `todo.yml` now declares only `contents: read` and `issues: write`; every workflow has an explicit permission set.
- [x] Build one channel-appropriate, validated VSIX and publish that same artifact to both registries. Reusable CI accepts a `pre_release` input, packages exactly one `vscode-pandoc.vsix` with the correct channel metadata, and both registry steps download and publish that file.
- [ ] Add lint, audit, and package-content checks. (Coverage is now done — a non-gating `coverage` job in `ci.yml` runs `test:coverage:headless` and uploads the report as a build artifact on every push/PR. Lint, `npm audit`, and VSIX package-content checks are still not wired into CI.)
- [ ] Exclude unused and development-only files from the VSIX. Reconfirmed with `vsce ls` on 2026-09-16: the package includes the 3.1 MB `images/vscodePandoc.gif`, `.github/`, `PROJECT_AUDIT.md`, `tslint.json`, `tsconfig.test.json`, `.claude/notes/project-knowledge.md`, `.claude/skills/`, and compiled `out/src`. Runtime `js-yaml`/`argparse` files are expected dependencies but should be reviewed as part of an allowlist-based package-content check. The previously cited `.claude/settings.local.json` is not present and does not ship.

## Test assessment

TypeScript compilation, test compilation, and the existing TSLint check pass as of 2026-09-16.

**Update**: both runner issues are fixed. The integration suite previously couldn't run because `@vscode/test-electron@2.5.2` did not recognize the newer macOS executable name; bumping to `3.1.0` fixed detection. The suite loader was also updated from the removed callback-style `glob()` API to the Promise-based `{ glob }` export. The original placeholder assertions were replaced with behavioral checks. A subsequent review found three output-channel tests that still only checked whether a mock method existed; these now execute rendering or migration and assert the exact logged content.

**Update (2026-08-04)**: `npm run test-compile` failed with `error TS5103: Invalid value for '--ignoreDeprecations'` at the start of this session — unrelated to any code change. `node_modules/typescript` had drifted to `5.9.2` while `package.json`/`package-lock.json` already pinned `^6.0.2`/`6.0.2` (the `ignoreDeprecations: "6.0"` in `tsconfig.test.json` is invalid under 5.9). A plain `npm install` resynced `node_modules` to the already-committed lockfile versions (no `package.json`/lockfile changes); `npm audit` still reports 0 vulnerabilities afterward.

Current verification result (2026-09-16): **137 passing, 0 failing** under the VS Code 1.138.0 Extension Host. TypeScript compilation, test compilation, TSLint, all eight real-Pandoc filter tests, workflow syntax, and `actionlint` also pass. The test launchers explicitly remove an inherited `ELECTRON_RUN_AS_NODE` value before `runTests()` so commands started from another VS Code extension host launch the desktop application correctly.

### Coverage reporting (2026-08-04)

`test:coverage` used to be an alias for `npm test` — no instrumentation, no report, just a misleading script name. Fixed with `c8` (not `nyc`): tests here don't run as plain `mocha` in the current process — `test/runTest.js` spawns a separate VS Code Extension Host process via `@vscode/test-electron`, and that's where the actual `src/*.ts`-compiled code executes. Istanbul-based tools like `nyc` instrument via require-hooks in the process that starts them, which doesn't reliably follow into that spawned child without extra subprocess-wrapping configuration. `c8` instead uses Node's native V8 coverage via the `NODE_V8_COVERAGE` env var, which every child process that inherits it writes raw coverage data into.

That inheritance still needed one explicit fix: `@vscode/test-electron`'s `runTests()` takes an `extensionTestsEnv` option ("Environment variables being passed to the extension test script") specifically for this. `test/runTest.js` and `test/runTest.headless.js` forward a copy of the parent environment, including `NODE_V8_COVERAGE`, into the Extension Host process where it is needed. They remove `ELECTRON_RUN_AS_NODE` from both launch environments first so a test command started by another extension host does not force the downloaded desktop application into Node mode.

- `npm run test:coverage` (GUI, local dev) / `npm run test:coverage:headless` (CI) — both run `test-compile` then wrap `node ./test/runTest(.headless).js` with `c8 --reporter=text --reporter=html --reporter=lcov --all --src=out/src --include="out/src/**"`. `--all` reports 0% for any matching file that no test ever touches, rather than letting it disappear from the report silently. `--include`/`--src` scope coverage to only the project's own compiled output, not mocha/sinon/node internals that also execute in-process.
- c8 uses source maps automatically (`v8-to-istanbul`), and `tsconfig.json` already had `sourceMap: true`, so the report shows original `.ts` filenames and line numbers, not compiled `.js`.
- Verified result as of 2026-08-04: **96.65% statements / 90.6% branches / 100% funcs / 96.65% lines** overall. Per file: `extension.ts` 100%, `commands.ts` 100% (branch 97.72%), `formats.ts` 100% (branch 83.33%, one untested branch at line 53), `configuration.ts` 98.8%, `renderer.ts` 97.05% (uncovered lines 28-31, 140-141), `outputChannel.ts` 100% (branch 66.66% — the `channel?.append` optional-chaining guard's "channel unset" path is never exercised, harmless), `commandBuilder.ts` 88.59% (uncovered lines 8-24, inside `parseShellArgs`'s unmatched-quote handling — the least-tested pure function, since most existing tests exercise it indirectly through `getDockerOptions`/format strings that don't hit that branch).
- `coverage/` is gitignored and excluded from the VSIX (`.vscodeignore`); it's a generated artifact, not committed.
- CI: a new non-gating `coverage` job in `.github/workflows/ci.yml` runs `test:coverage:headless` under `xvfb-run` and uploads `coverage/` as a build artifact on every push/PR — see "CI/release changes" above. No minimum-coverage gate yet; add one later once these numbers have been watched for a while (see the `commandBuilder.ts` gap above as a natural first candidate for new tests rather than a threshold fight).

Recommended test work:

- [x] Add pure unit tests for format validation, paths, argument parsing, collision prevention, and command construction. (`Input/Output Collision Guard Tests`, `Command Arguments Tests` in `test/suites/extension.test.ts`)
- [x] Add process-adapter tests for success, stderr warnings, cancellation, timeout, and failure.
- [x] Add Workspace Trust tests. (`should refuse to render in an untrusted workspace`)
- [x] Add dirty, untitled, and virtual-document tests.
- [x] Add Docker hardening tests. (`should apply hardened Docker defaults...`, `should mount the source directory read-only and route output through a separate /output mount`, `user-supplied dockerOptions should be appended after the hardened defaults`, `should migrate a legacy global/workspace docker.options string to a structured array`, `should not touch docker.options when it is already a structured array`)
- [x] Replace placeholder assertions with tests of production behavior. All 13 remaining `assert.ok(true)` placeholders in `test/suites/extension.test.ts` were replaced with assertions against actual `execFile` args, `showErrorMessage`/`showWarningMessage` calls, and config `update()` calls.
- [ ] Add a smaller genuine Extension Host integration suite.
- [x] Add Lua-filter fixtures for escaping and each supported renderer. `admonitionFormats.test.ts` exercises all six renderer branches against a real Pandoc binary and verifies special-character escaping in raw LaTeX, HTML, and DocBook titles.
- [x] Repair test-runner incompatibilities. `@vscode/test-electron` was bumped to `3.1.0`, `test/suites/index.js` was updated for `glob@13`'s Promise API, and both launchers strip inherited `ELECTRON_RUN_AS_NODE` before starting VS Code. The expanded suite passes under VS Code 1.138.0.

## Proposed implementation order

1. [x] Prevent output collisions, validate formats, enforce trust, prompt before replacement, require local saved documents, save dirty content after confirmation, and open output without shell interpolation.
2. [x] Introduce the typed format catalogue and modular renderer architecture. `src/extension.ts` is now split into `formats.ts`, `outputChannel.ts`, `configuration.ts`, `commandBuilder.ts`, `renderer.ts`, and `commands.ts` — see "Efficiency and code structure" below.
3. [ ] Reorganize settings and improve commands, picker, progress, and messages.
4. [x] Harden Docker and process execution. Pinned image, restricted container defaults, read-only input mount, isolated output mount, structured (and migrated) `docker.options`, process cancellation, timeout, and destination concurrency protection are all done.
5. [~] Upgrade dependencies, replace TSLint, and maintain tests/coverage. Six formerly listed dependency upgrades and vulnerability remediation are complete; VS Code types, TypeScript 7, TSLint→ESLint, and the remaining focused test work are open.
6. [~] Consolidate and secure CI/release workflows. Workflow permissions, SHA pinning, CodeQL v4, CI gating, and single-artifact publishing are complete. CI lint/audit/package-content checks and VSIX exclusions remain open.
7. [~] Rebuild and verify release artifacts. Compile, lint, dependency audit, the 137-test Extension Host suite, stable and pre-release packaging, workflow validation, and current package-content inspection pass as of 2026-09-16. VSIX content still needs cleanup.

## Implementation status

Implementation remains in progress. The reconciled checklists above reflect the repository as of 2026-09-16; dated historical results are retained only where they still provide useful context.
