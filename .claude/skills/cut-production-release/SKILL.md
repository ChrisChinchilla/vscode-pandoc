---
name: cut-production-release
description: Prepare a stable/production release of the vscode-pandoc extension — pick an even-minor X.Y.Z version, update the changelog and version files, rebuild the production bundle, verify, commit, and hand over the tag push. Use when asked to "cut a release", "prepare a production/stable release", or "ship X.Y.Z" (non-pre-release).
---

# Cut a production (stable) release

Stable and pre-release share one convention: **minor-version parity decides the
channel** (`.github/workflows/versionParity.yml`). The Marketplace rejects
semver pre-release suffixes, so there is no `-beta`; instead:

| Minor version | Channel | Workflows triggered by the `vX.Y.Z` tag |
|---------------|---------|----------------------------------------|
| **Even** (`1.2.0`, `1.4.1`) | **Stable** | `publishTags.yml`, `release.yml` |
| Odd (`1.1.0`, `1.3.2`) | Pre-release | `publishPreRelease.yml`, `preRelease.yml` |

For a production release the new version's **minor number must be even**. From
an odd-minor pre-release (`1.1.x`) the next stable is `1.2.0`. From an even-minor
stable (`1.2.x`) the next stable is normally `1.2.(z+1)` for fixes or `1.4.0` for
features (skip the odd minor unless you are also cutting a pre-release on it).

## Steps

1. **Confirm the version.** Read the current `version` in `package.json`, decide
   the new `X.Y.Z` with an **even** minor, and confirm it with the user before
   changing files.

2. **Review what's shipping.** `git log --oneline <lastTag>..HEAD` and skim the
   diffs. If the previous release was a pre-release, the stable entry must also
   surface every user-facing change that landed in that pre-release, since stable
   users never received it.

3. **Update `CHANGELOG.md`.** Add a new entry at the top:
   `- <Month Day><ordinal>, <Year> — **X.Y.Z (stable)**` followed by indented
   bullets grouped as features, fixes, and compatibility/dependency changes.
   Match the existing prose style (concise, imperative, non-US spelling). Fold in
   any `Unreleased` bullets. Do not rely on the auto-generated GitHub notes —
   they supplement, not replace, this file.

4. **Bump the version in both files:**
   - `package.json` → `"version": "X.Y.Z"`
   - `package-lock.json` → the two top-level `"version": "X.Y.Z"` occurrences
     (root and the `""` package entry, both near the top). Easiest: edit
     `package.json` then run `npm install --package-lock-only`.

5. **Keep docs consistent.** Verify README formats/settings/prerequisites and
   `contributing.md` still match the implementation. Fix drift as part of the
   release commit.

6. **Rebuild the production bundle.** `npm run package` runs
   `vscode:prepublish` = `webpack --mode production`, which rewrites
   `dist/extension.js` as the minified bundle and produces `vscode-pandoc-X.Y.Z.vsix`.
   Never commit a development/unminified `dist/extension.js` (a `npm run webpack`
   or `webpack-dev` build) — check `wc -l dist/extension.js` is ~2 lines, not
   thousands.

7. **Verify.**
   - `npm run compile` and `npm run test-compile` — must be clean.
   - `npm test` (or `npm run test:headless`) — the suite spawns a VS Code
     Extension Host via `@vscode/test-electron`; it may not run in every local
     sandbox. If it can't run here, say so explicitly and note that CI
     (`ci.yml`, reused by `publishTags.yml`) is the real gate — it runs the
     matrix on Ubuntu/Windows/macOS × Node 20/22 with Pandoc installed.
   - Inspect the `.vsix` contents if bundle size matters
     (`npx vsce ls` / unzip) — `.vscodeignore` is known to under-exclude.
   - Delete the local `.vsix` afterwards (gitignored, but don't leave it lying around).

8. **Commit** (only the release files: `CHANGELOG.md`, `package.json`,
   `package-lock.json`, `dist/extension.js`, plus any doc fixes). Suggested
   message:
   ```
   Release X.Y.Z

   <one-line summary of the headline change>

   Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
   ```

9. **Hand over the tag.** Do **not** push a tag automatically — tagging fires the
   publish workflows to Open VSX and the Marketplace. Give the user the exact
   commands and let them run them:
   ```sh
   git push origin main
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

10. **After the tag is pushed**, remind the user to check all four results, since
    the GitHub release workflow does not wait for CI:
    - `ci.yml` validation (via `publishTags.yml`)
    - Open VSX publish
    - VS Marketplace publish
    - the generated GitHub Release

11. **Update project state**: add a dated entry to
    `.claude/notes/project-knowledge.md` and any relevant memory.

## Repository secrets (already configured; for reference)

`VS_MARKETPLACE_TOKEN`, `OPEN_VSX_TOKEN`.
