# vscode-pandoc — project knowledge

Notes gathered while working in this repo, kept here (not in global memory)
so they travel with the repo and are visible to anyone working on it.

## Architecture

- Single entry point: `src/extension.ts` (~580 lines). Everything lives here:
  settings reads, the format catalogue, the quick pick, local/Docker argument
  building, and process invocation. No modularization yet.
- Build: webpack bundles `src/extension.ts` → `dist/extension.js`, which is
  committed to the repo (`vscode:prepublish` runs `webpack --mode production`).
  Regenerate and verify it after source changes before release.
- Tests: `test/suites/extension.test.ts`, run via `@vscode/test-electron`
  (`npm test` → `test/runTest.js`). As of 2026-08-03 this actually works end
  to end (69 passing) after two fixes — see "Test runner: previously broken,
  now fixed" below. `npm run test-compile` only type-checks/emits (`tsc -p
  tsconfig.test.json`) and copies `test/suites/index.js`; it does not run
  anything, so it can't tell you whether tests pass, only whether they compile.
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
  `SUPPORTED_FORMATS` in `src/extension.ts` — an array of `{ label,
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

## Workspace Trust and Docker hardening (as of 2026-08-03)

- `pandoc.render` now refuses to run outside a trusted workspace: `package.json`
  declares `capabilities.untrustedWorkspaces.supported: false`, and the
  command handler in `src/extension.ts` also checks `vscode.workspace.isTrusted`
  directly before doing anything else, since `pandoc.executable`, Docker
  options/image, and Lua filters are all workspace-controlled and feed a
  spawned process.
- Docker runs now get hardened defaults baked into the `docker run` args in
  `renderDoc()`: `--network=none`, `--cap-drop=ALL`,
  `--security-opt=no-new-privileges`. `pandoc.docker.options` is still
  appended after these, so a workspace can override them — that's judged
  acceptable because doing so already requires a trusted workspace.
- The default `pandoc.docker.image` changed from the mutable `pandoc/latex:latest`
  to a pinned tag, `pandoc/latex:3.10.0.0-ubuntu` (looked up via Docker Hub on
  2026-08-03 — re-check for a newer reviewed tag if it's been a while).
- **Not done**: read-only input mounts + isolated output directory. Pandoc
  currently writes its output file back into the same host directory that's
  bind-mounted for input (`filePath:/data`), so mounting it `:ro` would break
  every Docker render as-is. Doing this properly needs pandoc's output
  redirected to a separate writable mount (e.g. a temp dir) and the result
  copied back to the real output path after the container exits — that's real
  surgery on `renderDoc()`'s control flow and was deferred to the `renderer.ts`
  extraction work in `PROJECT_AUDIT.md` rather than bolted on unsafely.

## Other correctness fixes (as of 2026-08-03)

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
  stdout, stderr, and migration log content. The verified result remains 69
  passing, 0 failing as of 2026-08-03.
- `pandocOutputChannel` is created during `activate()`, not module import, and
  is added to `context.subscriptions` for disposal. This also means tests can
  stub `createOutputChannel` before activation and observe actual log calls.
- `execFile` is a single stubbed function shared by both the render call
  (called with a callback as arg[3]) and `openDocument()`'s
  `execFile("open"/"xdg-open", [outFile])` call (no callback at all). A stub
  configured with `.callsArgWith(3, ...)` throws when invoked without an
  arg at index 3. Any test where `render.openViewer` is `true` needs a
  `.callsFake((...args) => { if (typeof args[3] === 'function') args[3](...) })`
  -style stub instead — see `stubSuccessfulExecFile()` in the Integration
  Tests suite.
- `displayMenuAndRender()` reads `context.globalState.get('pandoc.formatUsage', {})`
  to sort/track usage; `mockContext.globalState.get` is a bare stub with no
  default return, so any test that reaches the quick-pick path must stub it
  (e.g. `mockContext.globalState.get = sandbox.stub().withArgs('pandoc.formatUsage', {}).returns({})`)
  or the format-usage sort throws on `undefined[format]`.
- The quick-pick path (`displayMenuAndRender` → `showQuickPick(...).then(...)`)
  is fire-and-forget from the command handler's perspective — `await
  commandCallback()` returns before the picker's `.then()` runs. Tests that
  need the post-pick render to have happened add
  `await new Promise((resolve) => setImmediate(resolve));` after awaiting
  the command to flush the promise chain.

## Where the fuller task list lives

`PROJECT_AUDIT.md` (repo root) is the authoritative, checklist-driven audit
of security/performance/maintainability work for this extension. Update its
checkboxes and the top findings table as items are completed rather than
duplicating that list here.
