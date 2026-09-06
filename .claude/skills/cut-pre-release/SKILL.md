---
name: cut-pre-release
description: Prepare a pre-release of the vscode-pandoc extension — pick an odd-minor X.Y.Z version, update the changelog and version files, rebuild the production bundle, verify, commit, and hand over the tag push. Use when asked to "cut a pre-release", "prepare a beta/preview build", or "ship a pre-release X.Y.Z".
---

# Cut a pre-release

Stable and pre-release share one convention: **minor-version parity decides the
channel** (`.github/workflows/versionParity.yml`). The Marketplace rejects
semver pre-release suffixes, so there is no `-beta`; instead:

| Minor version | Channel | Workflows triggered by the `vX.Y.Z` tag |
|---------------|---------|----------------------------------------|
| Even (`1.2.0`, `1.4.1`) | Stable | `publishTags.yml`, `release.yml` |
| **Odd** (`1.1.0`, `1.3.2`) | **Pre-release** | `publishPreRelease.yml`, `preRelease.yml` |

For a pre-release the new version's **minor number must be odd**. From an
even-minor stable (`1.2.x`) the next pre-release is `1.3.0`. From an odd-minor
pre-release (`1.1.x`) the next pre-release is `1.1.(z+1)`.

The pre-release publish path passes `preRelease: true` at package **and** publish
time (`publishPreRelease.yml`) — the flag is baked into the `.vsix` by `vsce`, so
that workflow always packages its own file and never reuses the plain CI VSIX.
You do not set this flag locally; you only need the odd minor and a correct
changelog label.

## Steps

1. **Confirm the version.** Read the current `version` in `package.json`, decide
   the new `X.Y.Z` with an **odd** minor, and confirm it with the user.

2. **Review what's shipping.** `git log --oneline <lastTag>..HEAD` and skim the
   diffs.

3. **Update `CHANGELOG.md`.** Add a new entry at the top:
   `- <Month Day><ordinal>, <Year> — **X.Y.Z (pre-release)**` followed by
   indented bullets (features, fixes, compatibility/dependency changes). Match
   the existing concise, imperative, non-US-spelling style. Fold in any
   `Unreleased` bullets.

4. **Bump the version in both files:**
   - `package.json` → `"version": "X.Y.Z"`
   - `package-lock.json` → the two top-level `"version"` occurrences (run
     `npm install --package-lock-only` after editing `package.json`).

5. **Keep docs consistent.** README formats/settings/prerequisites and
   `contributing.md` should match the implementation.

6. **Rebuild the production bundle.** `npm run package` runs
   `webpack --mode production` and rewrites `dist/extension.js` as the minified
   bundle. Never commit a dev/unminified bundle — `wc -l dist/extension.js`
   should be ~2 lines. (`vsce`'s pre-release packaging happens in CI, not here.)

7. **Verify.**
   - `npm run compile` and `npm run test-compile` — clean.
   - `npm test` / `npm run test:headless` — may not run in every local sandbox
     (`@vscode/test-electron` spawns a VS Code Extension Host). If it can't run
     here, say so; CI (`ci.yml`, reused by `publishPreRelease.yml`) is the gate.

8. **Commit** the release files only (`CHANGELOG.md`, `package.json`,
   `package-lock.json`, `dist/extension.js`, doc fixes). Suggested message:
   ```
   Pre-release X.Y.Z

   <one-line summary>

   Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
   ```

9. **Hand over the tag.** Do **not** push automatically — the tag fires publish
   workflows to Open VSX and the Marketplace as a pre-release. Give the user:
   ```sh
   git push origin main
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

10. **After the tag is pushed**, remind the user to check: `ci.yml` validation
    (via `publishPreRelease.yml`), the Open VSX pre-release publish, the VS
    Marketplace pre-release publish, and the generated GitHub pre-release
    (`preRelease.yml`, marked `prerelease: true`). These run independently, so a
    GitHub pre-release alone does not confirm the registries published.

11. **Update project state**: `.claude/notes/project-knowledge.md` and memory.

## Repository secrets (already configured; for reference)

`VS_MARKETPLACE_TOKEN`, `OPEN_VSX_TOKEN`.
