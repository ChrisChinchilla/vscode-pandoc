# vscode-pandoc — project knowledge

Notes gathered while working in this repo, kept here (not in global memory)
so they travel with the repo and are visible to anyone working on it.

## Architecture

- **Module layout (as of 2026-08-04)**: `src/extension.ts` used to be a
  single ~660-line file holding everything. It's now split into:
  - `formats.ts` — `SUPPORTED_FORMATS` catalogue, `isSupportedFormat()`,
    `getOutputFileExtension()`. No dependency on `vscode` or any sibling
    module — a leaf.
  - `outputChannel.ts` — owns the `vscode.OutputChannel`
    (`initOutputChannel()`, `log()`). Also a leaf. Exists as its own file
    (not folded into `configuration.ts` or `renderer.ts`, despite the
    audit's original module list not naming it) specifically to avoid a
    circular import: both `configuration.ts` (migration warnings) and
    `renderer.ts` (render logging) need to log, and `renderer.ts` already
    depends on `configuration.ts` for config reads.
  - `configuration.ts` — config getters, `resolveOutputFolder()`, and the
    two one-time migrations (`migrateDockerOptionsToArray`,
    `migrateUseDockerToDockerEnabled`). Imports `formats.ts` and
    `parseShellArgs` from `commandBuilder.ts`.
  - `commandBuilder.ts` — `parseShellArgs()` and the pure `buildCommand()`
    (local/Docker arg construction, extracted from what used to be inline
    in `renderDoc()`). Takes only primitives — no `vscode`/`child_process`/
    `fs` import — so it's usable in isolation. Imports nothing from
    `configuration.ts` (one-way dependency, `configuration.ts` → this
    file, not the reverse).
  - `renderer.ts` — `renderDoc()` (the orchestrator: collision guard, the
    `activeOutputPaths` concurrency-guard `Set`, overwrite prompt,
    cancellable/timeout-wrapped `execFile`, stdout/stderr/exec-error
    logging, viewer launch), plus `setStatusBarText()`/`openDocument()`
    (only ever called from here).
  - `commands.ts` — VS Code interaction glue: exported
    `handleRenderCommand(context, args?)` (the former inline
    command-registration callback body — trust check, editor/document
    checks, format resolution, dispatch), `displayMenuAndRender()`,
    `saveAndRender()`.
  - `extension.ts` — trimmed to just `activate()`: `initOutputChannel()`,
    register `pandoc.render` → `handleRenderCommand`, push disposables.
  - Dependency direction (no cycles): `formats.ts`/`outputChannel.ts` are
    leaves → `configuration.ts` → `formats.ts`, `commandBuilder.ts` →
    `renderer.ts` → all three of the above → `commands.ts` → `formats.ts`,
    `configuration.ts`, `renderer.ts` → `extension.ts`.
  - This was a pure internal reorganization verified against the existing
    88-test suite with **zero test-file changes** — every test only ever
    calls `extension.activate(mockContext)` (confirmed by grep before
    starting), and `activate()`'s external shape didn't change. It's also
    why sinon's stubbing style survives the move: `import { execFile } from
    "child_process"` and `import * as vscode from "vscode"` both compile
    (commonjs target) to live property-accesses on the shared, cached
    module objects rather than destructured copies, so
    `sandbox.stub(require('child_process'), 'execFile')` and
    `sandbox.stub(vscode.window, 'activeTextEditor')` keep working
    regardless of which file the call site lives in — as long as every
    module keeps that same import style and accesses properties at call
    time, not at module-top-level.
  - Along the way, `migrateUseDockerToDockerEnabled()` in `configuration.ts`
    replaced three near-identical inline global/workspace/folder blocks
    that used to live directly in `renderDoc()` with one loop, mirroring
    the pattern its sibling `migrateDockerOptionsToArray()` already used.
    Same messages, same behavior, same migration tests pass unchanged.
- Build: webpack bundles `src/extension.ts` (+ the modules above) →
  `dist/extension.js`, which is committed to the repo (`vscode:prepublish`
  runs `webpack --mode production`). No webpack/tsconfig changes were
  needed for the split — entry point and `include` globs already covered
  new files under `src/`. Regenerate and verify it after source changes
  before release (or after a structural refactor like this one).
- Tests: `test/suites/extension.test.ts`, run via `@vscode/test-electron`
  (`npm test` → `test/runTest.js`). As of 2026-08-04 this works end to end
  (88 passing) — see "Test runner: previously broken, now fixed" below for
  the two fixes that made it work at all. `npm run test-compile` only
  type-checks/emits (`tsc -p tsconfig.test.json`) and copies
  `test/suites/index.js`; it does not run anything, so it can't tell you
  whether tests pass, only whether they compile.
- Lint: `tslint` (deprecated upstream); `npm run lint` currently passes clean.

## Test runner: previously broken, now fixed (as of 2026-08-03)

`npm test` used to fail immediately, and the original audit assumed the
cached VS Code Electron install was simply corrupted. It wasn't — two real,
separate bugs were hiding behind that assumption:

1. `@vscode/test-electron@2.5.2` hardcodes `Contents/MacOS/Electron` as the
   binary path on macOS. Recent VS Code downloads (this repo pulled
   `1.131.0`) rename that binary to `Contents/MacOS/Code`. Bumped the
   dependency to `3.1.0`, which knows about the rename.
2. Once that was fixed, a second failure appeared inside the extension
   host: `TypeError: glob is not a function` at `test/suites/index.js:14`.
   That file used the old callback-style `glob(pattern, opts, cb)` API,
   which was removed in `glob@9+` (this repo depends on `glob@^13`). Fixed
   to `const { glob } = require('glob')` + `await glob(pattern, opts)`.

With both fixed, `npm test` runs the full suite for real. One environment
gotcha specific to this agent sandbox (not the project): it sets
`ELECTRON_RUN_AS_NODE=1`, which makes *any* Electron binary run as plain
Node instead of launching, producing `bad option: --xxx` errors that look
like a broken/corrupted VS Code download but aren't. Run with
`env -u ELECTRON_RUN_AS_NODE npm test` (or unset it) to get a real result in
this environment; normal dev machines and CI runners shouldn't have this set.

## Format handling (as of 2026-08-03)

- The list of supported pandoc output formats now lives in one place:
  `SUPPORTED_FORMATS` in `src/formats.ts` — an array of `{ label,
  description, extension? }`, with `isSupportedFormat()` as the runtime
  allowlist check and `getOutputFileExtension()` a thin lookup over it
  (`extension` defaults to `label` when omitted). The quick-pick items are
  derived from it. `getPandocOptions()` no longer has a 29-case switch either
  — every format's settings key follows the exact pattern `<label>OptString`
  (verified against all 29 formats), so it's one `.get(label + "OptString")`
  call. What's *not* unified yet: the 29 individual `pandoc.<format>OptString`
  entries in `package.json`'s configuration schema still have to be declared
  by hand (VS Code's configuration contribution point has no way to generate
  settings from code at build time), and the catalogue doesn't carry default
  arguments. Both are still open — see `PROJECT_AUDIT.md`.
- `args.outputType` (passed into the `pandoc.render` command via keybindings,
  command URIs, or other extensions) and `pandoc.defaultOutputFormat` (a
  workspace-controlled setting) are both validated against
  `SUPPORTED_FORMATS` before use. The `package.json` JSON-schema `enum` on
  `pandoc.defaultOutputFormat` is UI-only and is not a runtime guarantee.
- `renderDoc()` now refuses to run when the computed output path equals the
  input path (e.g. `document.md` exported as `gfm`/`commonmark`, or
  `document.html` exported as `html`), comparing paths case-insensitively on
  `darwin`/`win32`. This was previously unguarded and could truncate/overwrite
  the source file.

## Output folder feature (merged from `main`, 2026-08-03)

A separate PR on `main` (issue #30) added configurable output locations,
merged into this branch alongside the Workspace Trust/hardening work above.
`resolveOutputFolder(sourceFilePath)` in `src/configuration.ts`:
- Returns `pandoc.outputFolder` (trimmed) if set, else `sourceFilePath`.
- If `pandoc.render.promptForOutputFolder` is `true`, shows an input box
  (pre-filled with the configured folder or the source path) instead, and
  returns `null` if the user cancels — callers must check for `null` and
  bail out without rendering (see `saveAndRender()`).
- Called once per render, after the dirty-document save, before `renderDoc()`.
This is also now load-bearing for the Docker read-only-mount design above:
`outFolder` (defaulting to `filePath`) is what gets mounted at `/output`.

## Workspace Trust and Docker hardening (as of 2026-08-03)

- `pandoc.render` now refuses to run outside a trusted workspace: `package.json`
  declares `capabilities.untrustedWorkspaces.supported: false`, and the
  command handler (`handleRenderCommand()` in `src/commands.ts`) also checks `vscode.workspace.isTrusted`
  directly before doing anything else, since `pandoc.executable`, Docker
  options/image, and Lua filters are all workspace-controlled and feed a
  spawned process.
- Docker runs now get hardened defaults baked into the `docker run` args in
  `renderDoc()`: `--network=none`, `--cap-drop=ALL`,
  `--security-opt=no-new-privileges`. `pandoc.docker.options` is still
  appended after these, so a workspace can override them — that's judged
  acceptable because doing so already requires a trusted workspace.
- **Done (2026-08-03)**: `pandoc.docker.options` changed from a free-form
  shell-like string (parsed with the hand-rolled `parseShellArgs()`) to a
  structured `string[]` setting — see `getDockerOptions()` and
  `migrateDockerOptionsToArray()` in `src/configuration.ts`. A legacy string
  value found via `inspect("docker.options")` in any of the three scopes
  (global/workspace/folder) is parsed once with the same `parseShellArgs()`
  and rewritten in place as an array, with a one-time warning — this exactly
  mirrors the existing `pandoc.useDocker` → `pandoc.docker.enabled`
  migration pattern already in the codebase, reusing the same
  inspect-three-scopes-then-update shape. No new setting key was needed:
  the migration rewrites the *value* under the same `docker.options` key,
  since VS Code's `WorkspaceConfiguration.get()`/`.inspect()` just return
  whatever raw JSON is stored regardless of what type `package.json`'s
  schema currently declares. `parseShellArgs()` is still used for the
  per-format `pandoc.<format>OptString` settings, which remain free-form
  strings — that wasn't in scope for this change.
- The default `pandoc.docker.image` changed from the mutable `pandoc/latex:latest`
  to a pinned tag, `pandoc/latex:3.10.0.0-ubuntu` (looked up via Docker Hub on
  2026-08-03 — re-check for a newer reviewed tag if it's been a while).
- **Done (2026-08-03)**: the source directory is now mounted read-only
  (`-v <filePath>:/data:ro`), and output always goes through a second,
  always-present mount, `-v <outFolder>:/output`, with pandoc's `-o` arg
  pointing at `/output/<name>.<ext>` unconditionally — never a relative path
  inside `/data`. `outFolder` defaults to `filePath` when no custom output
  folder is configured (see `resolveOutputFolder()` below), so in that common
  case the *same host directory* ends up bind-mounted twice, at two different
  container paths, with two different permissions. That's intentional and
  Docker-supported: the kernel enforces each mount point's permissions
  independently, so the container still can't write into the `:ro` `/data`
  mount even though `/output` resolves to the identical files on disk. This
  was previously deferred because the old code only mounted `/output`
  *conditionally* (when a custom output folder differed from the input
  directory) and wrote directly into `/data` otherwise — making that mount
  unconditional was the actual fix, not a temp-dir-and-copy-back scheme (which
  was considered and rejected as unnecessarily complex once the dual-mount
  trick was recognized).
- One real behavioral consequence worth remembering: if a Lua filter or
  Pandoc writer tries to write a file next to the input document (not just
  produce the rendered output), that write now fails with a permission error
  in Docker mode, since `/data` is read-only. Documented in the README's
  Docker section. No known built-in filter does this today (the bundled
  admonitions filter doesn't write files), but worth checking if adding new
  bundled filters later.

## Other correctness fixes (as of 2026-08-03)

- The render command accepts only saved local `file:` documents. Untitled and
  virtual-filesystem documents are rejected before the picker, save attempt,
  or process invocation; `package.json` also declares virtual workspaces
  unsupported.
- Pandoc reads from disk, not the editor buffer. `saveAndRender()` checks
  `editor.document.isDirty` and awaits `editor.document.save()` immediately
  before rendering, aborting if the save fails. It is deliberately reached
  only after runtime format validation or quick-pick confirmation, so invalid
  arguments and picker cancellation do not save the document as a side effect.
- `getPandocExecutablePath()` used to return `undefined` when
  `pandoc.executable` wasn't configured, and the caller did
  `command = String(pandocExecutablePath)` — which stringifies `undefined`
  to the literal text `"undefined"` and would pass that as the command to
  `execFile`. In real usage this was masked because `package.json` declares
  a default of `"pandoc"` for that setting, so VS Code's config API always
  returns a non-empty string. But it's a live footgun for anything that
  reads config differently. Fixed to return `"pandoc"` as the explicit
  fallback and return type is now `string`, not `string | undefined`.
- `renderDoc()` is awaitable and reserves its normalized output path in
  `activeOutputPaths` until every exit path completes. If that destination is
  already active, a later request is rejected with a warning. If an output
  file already exists, a modal prompt requires an explicit **Overwrite**;
  dismissing it leaves the file untouched.
- Process execution runs inside a cancellable notification. Cancellation
  aborts `execFile` through an `AbortController`. `pandoc.render.timeout`
  defaults to 300 seconds and is passed to `execFile`; `0` disables it.
  Destination reservations are released in `finally`, including cancellation,
  timeout, errors, and overwrite-prompt dismissal.
- Successful output is opened with `vscode.env.openExternal(Uri.file(...))`,
  replacing the platform-specific `open`, `xdg-open`, and direct execution
  branches.

## Dependency vulnerabilities (as of 2026-08-03)

- `npm audit` was 7 vulnerabilities (5 high, 1 moderate, 1 low), all dev-only.
  `npm audit fix` (no `--force`) cleared 4 of them (`brace-expansion`,
  `fast-uri`, `js-yaml`, `picomatch`).
- The remaining 3 (`diff`, `serialize-javascript`, and mocha's own advisory
  for depending on vulnerable `diff`) come from `mocha`'s own dependency tree
  — `npm audit fix --force` wanted to *downgrade* mocha to 11.3.0, which isn't
  a real fix. Pinned the transitive deps directly instead via an `overrides`
  block in `package.json` (`diff@^9.0.0`, `serialize-javascript@^7.0.7`).
  `npm audit` now reports 0 vulnerabilities. If bumping mocha later, check
  whether the override is still needed.

## Test fixtures to be aware of

- `test/suites/extension.test.ts` mocks the active document as
  `/test/path/document.md` by default (see `mockDocument` in `setup()`),
  with `isDirty: false` and `save: sandbox.stub().resolves(true)`. Any test
  that exercises a format mapping back to `.md` (gfm, commonmark) needs a
  non-`.md` `mockDocument.fileName` or it will trip the input/output
  collision guard and `execFile` won't be called.
- The original `assert.ok(true)` placeholders were replaced with behavioral
  assertions. A later review also replaced three output-channel tests that
  merely checked for a mock method with production-path assertions for exact
  stdout, stderr, and migration log content. The verified result is 87
  passing, 0 failing as of 2026-08-03 (includes the merged-in "Output Folder
  Tests" suite, the Docker read-only/isolated-output tests, and the
  `docker.options` array-migration tests).
- The output channel is created by `initOutputChannel()` (`src/outputChannel.ts`)
  when `extension.ts`'s `activate()` calls it, not at module import, and is
  added to `context.subscriptions` for disposal. This also means tests can
  stub `createOutputChannel` before activation and observe actual log calls.
- `execFile` now represents only Pandoc/Docker rendering. Viewer tests should
  assert calls to the globally stubbed `vscode.env.openExternal` instead.
- `displayMenuAndRender()` reads `context.globalState.get('pandoc.formatUsage', {})`
  to sort/track usage; `mockContext.globalState.get` is a bare stub with no
  default return, so any test that reaches the quick-pick path must stub it
  (e.g. `mockContext.globalState.get = sandbox.stub().withArgs('pandoc.formatUsage', {}).returns({})`)
  or the format-usage sort throws on `undefined[format]`.
- The quick-pick and render paths are awaitable end to end; awaiting the
  registered command now waits for selection, rendering, and optional output
  opening to complete.

## Error/warning messaging (as of 2026-08-04)

- `renderDoc()`'s `execFile` callback used to dump raw text into
  `showErrorMessage` for two cases: any non-empty `stderr` (even on success —
  pandoc routinely writes non-fatal warnings there, e.g. citeproc notices),
  and any generic exec failure (`"exec error: " + error`, which can include
  the full command line). A real failure that also produced stderr output
  triggered *two* stacked popups. Fixed: stderr-with-no-error now shows a
  concise `showWarningMessage` ("...produced warnings. See the Pandoc output
  channel for details."); a real failure shows one concise
  `showErrorMessage` ("...rendering failed. See the Pandoc output channel
  for details.") — cancellation/timeout messages were already concise and
  are unchanged. Full detail (`stdout`, `stderr: ...`, `exec error: ...`)
  still always goes to the Pandoc output channel exactly as before, so
  nothing is lost, only moved out of the popup. README's Docker
  troubleshooting example was clarified to say that block is what appears in
  the output channel, not the popup.

## Release workflow hardening (as of 2026-08-04)

- `.github/workflows/build.yaml` was a byte-for-byte duplicate of `ci.yml`'s
  `build` job. Deleted it; `ci.yml`'s `build` job is now the only place a
  VSIX gets built in CI, and it already gates on the `test` job passing.
- `publishTags.yml` (the tag-triggered release) used to do `npm ci` then
  call `HaaLeo/publish-vscode-extension@v1` twice — once per registry —
  with no test step and no explicit package step. Each call independently
  re-packaged the extension from source, so the two registries could
  receive different bytes, and nothing had verified the tests passed first.
  Confirmed via `gh api repos/HaaLeo/publish-vscode-extension/contents/action.yml`
  that the action has an `extensionFile` input ("Path to the vsix file to
  be published. Cannot be used together with packagePath.") specifically
  for this. `publishTags.yml` now: checks out, installs, compiles, runs
  the full test suite (`xvfb-run -a npm run test:headless`), packages once
  via `npm run package`, captures the resulting filename into a
  `steps.vsix.outputs.path` step output (`echo "path=$(ls *.vsix)" >>
  "$GITHUB_OUTPUT"`), and passes that same path as `extensionFile` to both
  publish steps. The built VSIX is also uploaded as a workflow artifact.
- `@vscode/vsce` is now a devDependency (was previously only ever installed
  globally and unpinned via `npm install -g typescript vsce` in both the
  old `build.yaml` and `ci.yml`'s `build` job). `package.json`'s existing
  `"package": "vsce package"` script already resolves to the local binary
  automatically once it's a devDependency — `npm run` prepends
  `node_modules/.bin` to `PATH` — so no script rewrite was needed, just
  `npm install --save-dev @vscode/vsce` and swapping the global-install step
  for `npm run package`. The `typescript` half of that old global install
  was already redundant for the same reason (`npm run compile` already
  resolves the local `tsc`), so it came out too.
- Every `actions/checkout@v4`, `actions/setup-node@v4`,
  `actions/upload-artifact@v4`, and `HaaLeo/publish-vscode-extension@v1`
  reference in `ci.yml`/`publishTags.yml` is now pinned to a commit SHA
  with a `# vX.Y.Z` trailing comment. **Do not hand-guess these** — resolve
  via `gh api repos/<owner>/<repo>/git/refs/tags/<tag>` (following through
  the annotated-tag object via `.object.type == "tag"` →
  `git/tags/<that sha>` → `.object.sha` when the ref itself points at a tag
  object, not a commit directly), then cross-check the resulting SHA
  against `repos/<owner>/<repo>/tags` to confirm which release version it
  actually corresponds to before writing the comment. Current pins (as of
  2026-08-04, re-verify before assuming still current):
  - `actions/checkout` → `11d5960a326750d5838078e36cf38b85af677262` (v4.4.0)
  - `actions/setup-node` → `49933ea5288caeca8642d1e84afbd3f7d6820020` (v4.4.0)
  - `actions/upload-artifact` → `ea165f8d65b6e75b540449e92b4886f43607fa02` (v4.6.2)
  - `HaaLeo/publish-vscode-extension` → `f4ece70f329f66686bd71c54b1671353fe320e49` (v1.7.0)
- Both `ci.yml` and `publishTags.yml` now declare `permissions: contents:
  read` at the workflow level — neither needs any write scope; artifact
  upload doesn't require repo-contents permissions.
- **Deliberately out of scope** for this pass: `codeql.yml` (already had an
  explicit `permissions:` block before this work) and `todo.yml` (issue-bot
  workflow, unrelated to releases) were left untouched — not missed. CodeQL
  v2→v4 is tracked as its own separate, still-open `PROJECT_AUDIT.md` item.
- **New finding while verifying** (ran `npm run package` locally to prove
  the path works before relying on it in CI): the produced `.vsix` bundles
  far more than the already-known 3.11 MB GIF — the entire `.github/workflows/`
  directory, `PROJECT_AUDIT.md`, `tslint.json`, `tsconfig.test.json`, and
  the entire `.claude/` directory including `.claude/notes/project-knowledge.md`
  and `.claude/settings.local.json`. `.vscodeignore` has no rule for any of
  these. Not fixed here (separate audit item, "Exclude the unused 3.26 MB
  GIF and other development files from the VSIX") but flagged with specifics
  in `PROJECT_AUDIT.md` since `.claude/settings.local.json` shipping in a
  public package is a real (if minor) concern, not just bundle bloat.

## Coverage reporting via c8 (as of 2026-08-04)

- `test:coverage` used to just be `npm test` under a misleading name. Fixed
  with `c8`, deliberately not `nyc` — tests here don't run as plain `mocha`
  in the current process: `test/runTest.js`/`test/runTest.headless.js` spawn
  a separate VS Code Extension Host process via `@vscode/test-electron`, and
  that child process is where `src/*.ts`-compiled code actually executes.
  `nyc`'s default instrumentation is require-hook-based in the process that
  starts it and doesn't reliably follow into a spawned child without extra
  subprocess-wrapping config. `c8` uses Node's native V8 coverage via the
  `NODE_V8_COVERAGE` env var, which any child process that inherits it
  writes raw coverage into — a much better fit for this process topology.
- That inheritance still needed one explicit fix, not just ambient env
  passthrough: `@vscode/test-electron`'s `runTests()` has an
  `extensionTestsEnv` option (`node_modules/@vscode/test-electron/out/runTest.d.ts`)
  built exactly for this — "Environment variables being passed to the
  extension test script." Both `test/runTest.js` and
  `test/runTest.headless.js` now pass `extensionTestsEnv: process.env`, so
  whatever `c8` sets on the launcher process (in particular
  `NODE_V8_COVERAGE`) reaches the actual Extension Host process rather than
  depending on however VS Code happens to spawn that child internally.
- Scripts: `npm run test:coverage` (GUI) / `npm run test:coverage:headless`
  (CI) both run `test-compile` then wrap `node ./test/runTest(.headless).js`
  with `c8 --reporter=text --reporter=html --reporter=lcov --all
  --src=out/src --include="out/src/**"`. `--all` makes untouched files show
  up as 0% instead of silently vanishing from the report; `--include`/`--src`
  keep the report scoped to the project's own compiled output instead of
  mocha/sinon/Node internals that also execute in the same process.
- c8 auto-detects and applies source maps (`v8-to-istanbul`), and
  `tsconfig.json` already had `sourceMap: true`, so the report shows
  original `.ts` filenames/line numbers, not the compiled `.js` — confirmed
  by actually running it, not assumed.
- Verified real (non-zero, per-file) numbers on first run, 2026-08-04:
  96.65% statements overall. `commandBuilder.ts` was the weakest file at
  88.59% (uncovered lines 8-24, inside `parseShellArgs`'s unmatched-quote
  handling) — a reasonable first target if adding tests specifically for
  coverage later, since it's the one module designed to be trivially
  unit-testable in isolation (no `vscode`/`child_process`/`fs` dependency).
- `coverage/` is gitignored and added to `.vscodeignore` (generated
  artifact, never committed or packaged).
- CI: added a `coverage` job to `.github/workflows/ci.yml` (parallel to
  `test`/`build`, not gating either) that runs `test:coverage:headless`
  under `xvfb-run` and uploads `coverage/` as a build artifact. No minimum
  threshold enforced yet — deliberately deferred until real numbers have
  been watched for a while, per user preference when this was scoped.

## Missing-editor warning and keybinding language scope (as of 2026-08-04)

- `pandoc.render`'s command handler used to `return` silently when
  `vscode.window.activeTextEditor` was undefined (e.g. invoked from the
  command palette or the default keybinding with no editor focused, or a
  non-text panel focused). It now shows `showWarningMessage("pandoc: no
  active editor. Open a document to render it.")` first, matching the
  pattern already used for untitled/non-file documents in
  `isLocalSavedDocument()`.
- The default `ctrl+K P`/`cmd+K P` keybinding's `when` clause in
  `package.json` only checked `editorLangId == 'markdown' ||
  editorLangId == 'restructuredtext'`, even though `activationEvents` (and
  therefore the extension's actual intended language support) also lists
  asciidoc, xml, html, and epub. The keybinding now checks all six —
  mirrored 1:1 from `activationEvents`, not independently curated. Note:
  `activationEvents` itself (including whether `onLanguage:epub` is even a
  real language ID anyone's editor registers) is untouched here — that's
  the separate, not-yet-done "remove broad language activation" item in
  `PROJECT_AUDIT.md`. If that item changes or removes `activationEvents`
  later, revisit whether this keybinding's language list should change too.

## Environment gotcha: node_modules can drift from package-lock.json (found 2026-08-04)

`npm run test-compile` failed with `TS5103: Invalid value for
'--ignoreDeprecations'` even though nothing in this session had touched
TypeScript config. Cause: `node_modules/typescript` was `5.9.2` while
`package.json` (`^6.0.2`) and `package-lock.json` (resolved `6.0.2`) already
expected 6.x — `tsconfig.test.json`'s `ignoreDeprecations: "6.0"` is invalid
under 5.9. A plain `npm install` (no lockfile edits) resynced it. If
`test-compile` fails with an obscure tsconfig error and the diff doesn't
touch tsconfig/package.json, check `node_modules/<pkg>/package.json` against
`package-lock.json` before assuming it's a real regression.

## Where the fuller task list lives

`PROJECT_AUDIT.md` (repo root) is the authoritative, checklist-driven audit
of security/performance/maintainability work for this extension. Update its
checkboxes and the top findings table as items are completed rather than
duplicating that list here.
