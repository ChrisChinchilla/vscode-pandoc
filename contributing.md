# Contributing

## Development setup

Use Visual Studio Code **1.110 or newer** and Node.js **20.9 or newer**, as declared in [package.json](package.json). CI tests Node.js 20 and 22; packaging and coverage use Node.js 22.

Clone the repository, open it in VS Code, and install the locked dependencies:

```sh
npm ci
```

Install Pandoc to exercise real conversions and the admonition integration tests. PDF rendering also needs a PDF engine; see the [README prerequisites](README.md#prerequisites). The integration tests inspect generated LaTeX without compiling a PDF, so they do not require TeX. Docker is needed only to exercise container-based rendering.

## Source layout

- `src/extension.ts` and `src/commands.ts`: activation, commands, and render orchestration.
- `src/configuration.ts`: settings and profiles.
- `src/formats.ts`: supported format identifiers, output extensions, and reference-document support.
- `src/frontmatter.ts`: document-level Pandoc arguments.
- `src/commandBuilder.ts` and `src/renderer.ts`: process arguments and render execution.
- `src/outputChannel.ts`: diagnostic output.
- `test/suites/`: extension and format integration tests.
- `dist/extension.js`: bundled extension entry point.

When adding formats or settings, keep `package.json`, the format catalogue, and the README consistent. Document user-facing changes in [CHANGELOG.md](CHANGELOG.md) as part of the change; use an Unreleased entry until a release version and date are established.

## Building and debugging

```sh
# Compile TypeScript
npm run compile

# Watch TypeScript sources
npm run watch

# Build the development bundle
npm run webpack

# Rebuild the bundle as sources change
npm run webpack-dev

# Package a VSIX (runs the production webpack build through vscode:prepublish)
npm run package
```

Use **Run Extension** in VS Code's Run and Debug view, then press F5. Its launch configuration builds the webpack bundle and opens an Extension Development Host. Open a supported document there and run **Pandoc Render**. Inspect the **Pandoc** output channel for process arguments, warnings, and errors.

The extension loads `dist/extension.js`; compiling TypeScript alone does not refresh that bundle. Use webpack when testing runtime changes in the development host.

## Running tests

```sh
# Compile tests and run them in a VS Code Extension Host
npm test

# Alternate test runner; enables headless launch arguments when CI is set
npm run test:headless

# Linux runner using a virtual framebuffer (requires xvfb-run)
npm run test:ci

# Collect coverage locally
npm run test:coverage

# Linux coverage run matching CI
CI=true xvfb-run -a npm run test:coverage:headless
```

The test commands compile the test sources automatically. The runners use `@vscode/test-electron` and may download VS Code on first use. Headless tests still launch VS Code; Linux CI supplies a virtual display with Xvfb.

The suites cover configuration, Docker migration and execution, cross-platform paths, render workflows, errors, profiles, render-on-save, frontmatter arguments, and document templates. Most workflow tests mock `execFile` and assert the arguments passed to Pandoc.

Admonition format integration tests run the real Pandoc binary with the bundled Lua filter. They check HTML, DOCX, RST, AsciiDoc, DocBook, and LaTeX output. These tests skip when Pandoc is absent from `PATH`; CI installs Pandoc so they run there.

Coverage commands write text, HTML, and LCOV reports under `coverage/`. There is currently no minimum coverage threshold.

For code changes, run compilation and the relevant tests before submitting a pull request. `npm run lint` is also available for the repository's TSLint checks, but is not currently part of CI. For documentation-only changes, check factual claims, links, and formatting against the source and workflows.

## CI/CD

[CI](.github/workflows/ci.yml) runs on pushes and pull requests to `main` and `develop`, supports manual runs, and is reusable by the publishing workflows.

- Tests run across Ubuntu, Windows, and macOS with Node.js **20 and 22**. Every test job installs Pandoc and compiles TypeScript; Linux uses Xvfb.
- Coverage runs separately on Ubuntu with Node.js 22 and uploads the `coverage-report` artifact. It reports coverage without enforcing a percentage threshold.
- Packaging waits for the test matrix, builds on Ubuntu with Node.js 22, and uploads the `vscode-pandoc-vsix` artifact.
- [CodeQL](.github/workflows/codeql.yml) runs JavaScript security and quality analysis on pushes and pull requests to `main`, plus a weekly schedule.
- [TODO automation](.github/workflows/todo.yml) runs the TODO-to-issue action on pushes and pull requests to `main`, and on manual runs.

## Release process

All release and publishing workflows trigger on pushed `v*` tags. [Version parity](.github/workflows/versionParity.yml) determines the release channel from the tag's minor version:

| Minor version | Channel | Example |
|---------------|---------|---------|
| Odd | Pre-release | `v1.1.0` |
| Even | Stable | `v1.2.0` |

Use a plain `X.Y.Z` package version and matching `vX.Y.Z` tag; the workflows use minor-version parity rather than a `-beta` suffix.

Before tagging:

1. Review commits since the previous release and update [CHANGELOG.md](CHANGELOG.md) with the version, date, channel, features, fixes, and compatibility changes. Move any Unreleased notes into that entry.
2. Keep README formats, settings, and prerequisites aligned with the implementation, and update this guide when development or workflow behavior changes.
3. Update the version in both `package.json` and `package-lock.json`, keeping them consistent with the intended tag.
4. Run compilation, tests, and packaging; review the resulting changes before committing and pushing the release tag.

[Stable publishing](.github/workflows/publishTags.yml) and [pre-release publishing](.github/workflows/publishPreRelease.yml) call the reusable CI workflow before publishing to **Open VSX** and the **Visual Studio Marketplace**. They require repository secrets `OPEN_VSX_TOKEN` and `VS_MARKETPLACE_TOKEN` respectively.

Publishing packages the extension afresh for each registry. The pre-release workflow sets `preRelease: true` during packaging and publishing; do not substitute the ordinary CI VSIX, which lacks the pre-release package metadata.

[GitHub releases](.github/workflows/release.yml) and [GitHub pre-releases](.github/workflows/preRelease.yml) are created by separate workflows with automatically generated release notes. These workflows run independently of publishing and do not wait for CI, so a GitHub release alone does not confirm successful marketplace publication. Check the CI, GitHub release, and both registry publishing results after pushing a tag. Generated GitHub notes do not replace the maintained [CHANGELOG.md](CHANGELOG.md).
