# vscode-pandoc

The vscode-pandoc [Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=chrischinchilla.vscode-pandoc) extension lets you render markdown files as a PDF, word document, or HTML file.

> Thanks to the previous work of [@dfinke](https://github.com/dfinke) on this extension.

## Prerequisites

You need to [**install Pandoc**](http://pandoc.org/installing.html) - a universal document converter.

By default, Pandoc creates PDFs using [LaTeX](https://www.latex-project.org). If you want to use the extension for rendering PDFs, you also need to install a PDF engine. Recommendations are:

- macOS: [BasicTeX](https://www.tug.org/mactex/morepackages.html)
- Windows: [MiKTeX](https://miktex.org)
- Linux: [TeX Live](https://www.tug.org/texlive/)

## Usage

Pandoc can convert many different file formats to another, but not all work to and from each other. For example, most relevant to this extension, Pandoc can convert from Markdown to most other formats, but can only convert **to** AsciiDoc. [Read the full list](https://pandoc.org) for more details on supported conversion formats.

There are two ways to run the extension. You need to have a supported file open.

1. Press _F1_ on Windows or _shift+cmd+P_ on Mac, type "pandoc", press _Enter_.
2. Press the key combination _ctrl+K_ then _P_ or _cmd+K_ then _P_ on Mac.

Choose from the list the document type you want to render and hit _enter_ (you can also type in the box rather than cursor around).

Pandoc reads local files from disk, not from the editor buffer. Untitled documents and documents provided by virtual filesystems are rejected with an explanatory error. If a local document has unsaved changes, the extension saves it after the output format is confirmed and then renders the saved content. If the save fails, rendering is cancelled instead of silently exporting stale content.

Rendering appears as a cancellable progress notification. It times out after five minutes by default, and a second render targeting the same output is rejected until the first finishes.

## Settings

Override these options in the Pandoc extension settings section, or find `pandoc` in _settings.json_ and set the options.

### Override the default executable

Override this in the Pandoc extension settings section, or find `pandoc` in _settings.json_ and set the options.

- Executable / `pandoc.executable`: Path to the Pandoc executable.

  - Default: Gets the path from the system's PATH variable.

### Set the default output format

To set a default export format and bypass the format list prompt, set the `pandoc.defaultOutputFormat` option in the settings.

Only the formats listed in the format picker (Pandoc's supported output formats) are accepted. If `pandoc.defaultOutputFormat` is set to anything else, the extension shows an error instead of rendering.

### Render on save

Set `pandoc.render.onSave` to `true` to automatically render every time you save a supported document (Markdown, AsciiDoc, XML, HTML, EPUB, or reStructuredText), instead of running **Pandoc Render** manually.

- Render on Save / `pandoc.render.onSave`: Automatically render to `pandoc.defaultOutputFormat` on every save.

  - Default: `false`

Render-on-save always targets `pandoc.defaultOutputFormat` — there's no separate format setting for it, and no format picker on save, since prompting on every keystroke-triggered save would be disruptive. **`pandoc.defaultOutputFormat` must be set** for this to do anything; if `pandoc.render.onSave` is enabled without it, the extension shows one warning (not one per save) explaining that a format is required, and does not render.

Example `settings.json`:

```json
{
  "pandoc.defaultOutputFormat": "pdf",
  "pandoc.render.onSave": true
}
```

Unlike a manual render, render-on-save does **not** show the "file already exists, overwrite?" prompt, or the output-folder input box even if `pandoc.render.promptForOutputFolder` is enabled — it silently renders to the configured (or default) output folder and overwrites the previous output on every save. That's the point of the feature (continuous rendering as you write), and a modal popup on every `Ctrl+S` would defeat it; both prompts still apply to manually-triggered renders. Combine with [`pandoc.outputFolder`](#set-the-output-folder) or a [profile](#profiles) if you'd rather the repeatedly-overwritten file live somewhere other than next to your source document.

If you save again while a render triggered by a previous save is still running (for example with `files.autoSave: afterDelay` while typing), the extension doesn't start a second overlapping Pandoc process for that document. Instead, it collapses the intervening saves into a single trailing render that starts once the in-flight one finishes, so the output always ends up reflecting your latest saved content without piling up concurrent renders. If two different documents happen to render to the very same output path (e.g. via profiles pointing at a shared output folder) a save-triggered render also waits for another in-flight render already writing that same file, rather than being dropped with a warning like a manual render would be.

Because this is a plain VS Code setting, you can scope it to specific languages or folders using VS Code's own [language-specific settings](https://code.visualstudio.com/docs/configure/settings#_language-specific-editor-settings) rather than any custom configuration in this extension — for example, to enable it only for Markdown files:

```json
{
  "[markdown]": {
    "pandoc.render.onSave": true
  },
  "pandoc.defaultOutputFormat": "html"
}
```

The same applies to `pandoc.defaultOutputFormat` itself, if you want different saved formats for different languages.

### Output overwriting the source file

Some output formats map back to the input file's own extension — for example, Markdown exported as `gfm` or `commonmark`, or an HTML file exported as `html`. If the computed output path would be identical to the input file, the extension refuses to run and shows an error, rather than truncating or overwriting your source file. Rename the input file or pick a different format to work around this.

If a separate output file already exists, the extension asks whether to overwrite it. Choose **Overwrite** to continue or cancel the prompt to leave the existing file unchanged.

### Render timeout and output viewer

- Render timeout / `pandoc.render.timeout`: Maximum render duration in seconds. The default is `300` (five minutes); set it to `0` to disable the timeout.
- Open viewer / `pandoc.render.openViewer`: Opens a successful output using VS Code's cross-platform external-opening API.

### Set the output folder

By default, rendered files are saved in the same directory as the source file. You can configure a different output location:

- Output Folder / `pandoc.outputFolder`: Default output folder for rendered files. Supports absolute paths. Leave empty to save output alongside the source file.

  - Default: `""` (empty, saves output in the same directory as the source file)

- Prompt for Output Folder / `pandoc.render.promptForOutputFolder`: When enabled, an input box appears before each render so you can specify (or confirm) the output folder. If `pandoc.outputFolder` is set, it is pre-filled as the default value.

  - Default: `false`

Example `settings.json` to always output to a fixed folder:

```json
{
  "pandoc.outputFolder": "/home/user/documents/rendered"
}
```

Example `settings.json` to be prompted for the output folder on every render:

```json
{
  "pandoc.render.promptForOutputFolder": true
}
```

You can combine both: set `pandoc.outputFolder` as a convenient default that the prompt pre-fills, while still allowing you to override it per run.

### Profiles

If you render documents for multiple clients or projects that each need different Pandoc options (for example, a different `--reference-doc` template per client), define named profiles instead of editing settings every time you switch:

```json
{
  "pandoc.profiles": {
    "client1": {
      "docxOptString": "--reference-doc=/path/to/client1/template.docx"
    },
    "client2": {
      "docxOptString": "--reference-doc=/path/to/client2/template.docx",
      "outputFolder": "/path/to/client2/output"
    }
  },
  "pandoc.defaultProfile": "client1"
}
```

- A profile can override any of the `pandoc.<format>OptString` settings and `pandoc.outputFolder`. Any key it doesn't set falls back to the corresponding top-level `pandoc.*` setting.
- Run **Pandoc: Select Profile** from the Command Palette to choose the active profile (or "Default" to clear it and use the base settings). The choice is remembered for the current workspace, so you don't need to reselect it on every render — it only changes when you run the command again.
- `pandoc.defaultProfile` is used the first time you render in a workspace, before you've explicitly picked a profile with the command. It's ignored if it doesn't match a key in `pandoc.profiles`.
- While a profile is active, the status bar and the render progress notification show its name alongside the format (e.g. `Generating [docx] (client1)`).
- Leaving `pandoc.profiles` empty (the default) preserves current behavior; no profile picker or status text appears.

### Sort formats by frequency

By default, the format selection list is sorted by how often you use each format, so your used formats appear at the top. You can disable this behaviour with the `pandoc.sortByFrequency` setting.

### Set Keybindings to formats

You can set keybindings to specific formats in a _keybindings.json_ file. For example, to set a keybinding for exporting to PDF, add:

```json
{
  "key": "ctrl+alt+p",
  "command": "pandoc.render",
  "args": { "outputType": "pdf" }
}
```

Setting these skips the format selection prompt and directly exports to the specified format, but you can still use the default render command to choose a format from the list. `outputType` is validated the same way as `pandoc.defaultOutputFormat`; an unrecognized value shows an error instead of rendering.

### Lua Filters

Pandoc supports [Lua filters](https://pandoc.org/lua-filters.html) that can transform the document AST during conversion. You can specify one or more Lua filter file paths using the `pandoc.luaFilters` setting.

- Lua Filters / `pandoc.luaFilters`: List of absolute paths to Lua filter files to pass to Pandoc via `--lua-filter`.

  - Default: `[]` (empty, no filters applied)

Example `settings.json`:

```json
{
  "pandoc.luaFilters": [
    "/path/to/custom-filter.lua"
  ]
}
```

### Admonition support

The extension includes a built-in Lua filter for [Docusaurus and other tool style admonitions](https://docusaurus.io/docs/markdown-features/admonitions). Enable it with the `pandoc.enableAdmonitions` setting.

- Enable Admonitions / `pandoc.enableAdmonitions`: Enable built-in rendering of admonition blocks.

  - Default: `false`

#### Prerequisites

<!-- TODO: Consolidate and/or lessen these dependencies -->

You need the following TeX packages installed for PDF rendering:

- [tcolorbox](https://ctan.org/pkg/tcolorbox)
- [tikzfill](https://ctan.org/pkg/tikzfill)
- [pdfcol](https://ctan.org/pkg/pdfcol)
- [listingsutf8](https://ctan.org/pkg/listingsutf8)

#### Supported admonition types

Use fenced div syntax in your Markdown:

```markdown
:::note
This is a note.
:::

:::tip
Helpful tip here.
:::

:::info
Informational content.
:::

:::warning
Be careful!
:::

:::danger
Critical warning.
:::
```

You can also add a custom title:

```markdown
:::warning[Watch Out]
This has a custom title.
:::
```

#### Format-specific rendering

| Format | Rendering |
|--------|-----------|
| **PDF** | Colored `tcolorbox` boxes with title header. Requires the LaTeX `tcolorbox` package (included in most TeX distributions). |
| **HTML / EPUB** | Styled `<div>` elements with colored left border and background (inline CSS, no external stylesheet needed). |
| **DOCX** | Bold title paragraph with an "Admonition" custom style (can be styled in a reference document). |
| **RST** | Native reStructuredText admonition directives (`.. note::`, `.. warning::`, etc.). |
| **AsciiDoc** | Native AsciiDoc admonition blocks (`NOTE`, `TIP`, `WARNING`, etc.). |
| **DocBook** | Native DocBook admonition elements (`<note>`, `<warning>`, `<tip>`, etc.). |

Example `settings.json`:

```json
{
  "pandoc.enableAdmonitions": true
}
```

#### Changing how admonitions render

You can also combine the built-in filter with your own custom Lua filters to change how they look by default. The admonition filter runs first, then your filters.

### Mermaid diagrams

Pandoc doesn't render [Mermaid](https://mermaid.js.org/) diagrams natively, but it can shell out to one via its generic `--filter` (`-F`) mechanism. This extension doesn't bundle Mermaid support, but you can wire it up yourself:

1. Install [`mermaid-filter`](https://github.com/raghur/mermaid-filter) globally so it's on your `PATH`:

   ```sh
   npm install -g mermaid-filter
   ```

2. Add `-F mermaid-filter` to the `pandoc.<format>OptString` setting(s) for every output format you want diagrams rendered in (for example `pandoc.pdfOptString`, `pandoc.htmlOptString`, `pandoc.docxOptString`):

   ```json
   {
     "pandoc.pdfOptString": "-F mermaid-filter",
     "pandoc.htmlOptString": "-s -F mermaid-filter"
   }
   ```

   Unlike `pandoc.luaFilters`, there's currently no single setting that applies a `-F` filter to every format at once — add it to the OptString of each format you use.

In your Markdown, fence the diagram as a `mermaid` code block:

````markdown
```mermaid
graph TD
  A --> B
```
````

`mermaid-filter` replaces the block with a rendered image before Pandoc converts the document, so this works for any output format, not just formats VS Code's own preview understands.

**Docker note:** if you use `pandoc.docker.enabled`, `-F mermaid-filter` won't work with the default `pandoc.docker.image` — that image doesn't include Node.js or `mermaid-filter`. You'd need to build and configure a custom image that has both installed.

### Additional Pandoc command line options

Set additional command line options for each output format.

Some formats default to `-s` (`--standalone`) in this extension so Pandoc generates full documents by default. You can remove `-s` in settings if you want fragment output.

- Defaults to `-s`: `pandoc.htmlOptString`, `pandoc.docbookOptString`, `pandoc.latexOptString`, `pandoc.beamerOptString`, `pandoc.rtfOptString`, `pandoc.opmlOptString`, `pandoc.texinfoOptString`, `pandoc.revealjsOptString`
- Pandoc already enables standalone automatically for: PDF, EPUB, FB2, DOCX, ODT

> default: `$ pandoc inFile.md -o outFile.{pdf|word|html}`

- PDF Opt String / `pandoc.pdfOptString`: PDF output additional command line options to use.
- DOCX Opt String / `pandoc.docxOptString`: DOCX document output additional command line options to use.
- HTML Opt String / `pandoc.htmlOptString`: HTML output additional command line options to use.
- AsciiDoc Opt String / `pandoc.asciidocOptString`: AsciiDoc output additional command line options to use.
- DocBook Opt String / `pandoc.docbookOptString`: DocBook output additional command line options to use.
- EPUB Opt String / `pandoc.epubOptString`: EPUB output additional command line options to use.
- RST Opt String / `pandoc.rstOptString`: RST output additional command line options to use.

Below are example options you can set for each output format.

For example to create a Japanese PDF:

`pandoc.pdfOptString`: "--pdf-engine=lualatex -V documentclass=ltjarticle -V geometry:a4paper -V geometry:margin=2.5cm -V geometry:nohead"

To create an HTML5 document:

`pandoc.htmlOptString`: "-s -t html5"

> For more information, read the [Pandoc User's Guide](http://pandoc.org/README.html).

### Custom CSS and Pandoc defaults files

There's no dedicated setting for either of these, but both are just Pandoc command line flags, so they work through the same `pandoc.<format>OptString` settings as any other option above.

**Custom CSS**, for HTML/EPUB/Reveal.js output, via [`--css`](https://pandoc.org/MANUAL.html#option--css):

```json
{
  "pandoc.htmlOptString": "-s --css=/path/to/style.css"
}
```

`--css` can be repeated to include more than one stylesheet, and accepts a URL as well as a local path. Note that most browsers block `file://` stylesheet links for security reasons — if the rendered HTML doesn't pick up local CSS when opened directly, either use `--embed-resources --standalone` (which inlines the CSS instead of linking it) or serve the file over `http://` rather than opening it from disk.

**Defaults files**, Pandoc's own [YAML-based option bundles](https://pandoc.org/MANUAL.html#default-files), via `--defaults` (or `-d`):

```json
{
  "pandoc.pdfOptString": "--defaults=/path/to/defaults.yaml"
}
```

A defaults file can set almost anything an OptString can (reader/writer options, variables, filters, metadata, resource paths) in one reusable, version-controllable file instead of a single-line string in settings — useful if your options are long, or you already maintain one for command-line use outside VS Code. Anything also present directly in the OptString is layered on top of (and can override) the defaults file. If you need to switch between several such files per client/project rather than editing settings each time, see [Profiles](#profiles) above, which can point different profiles at different `--defaults` files (or templates, output folders, etc.) per format.

## Docker Options

Set the `pandoc.docker.enabled` option to `true` and the extension runs Pandoc in a container using the official [pandoc/latex](https://hub.docker.com/r/pandoc/latex) image. This could result in a delay the first time it runs, or after an update to the container while it pulls down the new image.

- Docker: Enabled / `pandoc.docker.enabled`: Enable running Pandoc in a Docker container.

  - Default: `false`

- Docker: Image / `pandoc.docker.image`: Specify the Docker image to use when running Pandoc in a container.

  - Default: `pandoc/latex:3.10.0.0-ubuntu`. This is a specific, reviewed image version rather than the mutable `latest` tag, so a render can't silently start pulling different, unreviewed image contents.

- Docker: Options / `pandoc.docker.options`: Additional Docker CLI arguments to pass when running Pandoc in a container, as a **list of individual arguments** rather than a single shell-like string — for example:

  ```json
  "pandoc.docker.options": ["--user", "1000:1000", "--memory", "512m"]
  ```

  - Default: `[]`
  - If you have an older `pandoc.docker.options` set as a single string (e.g. `"--user $(id -u):$(id -g)"`), it's migrated automatically the next time you render: the extension parses it the same way it always did and rewrites the setting as a list, with a one-time notification. Nothing else changes — you don't need to do this by hand, but you may want to double-check the migrated list in Settings if your original string used shell features (like `$(...)` substitution) that a real shell would have expanded and this extension's parser does not.

Every Docker run also gets hardened defaults: no network access (`--network=none`), no Linux capabilities (`--cap-drop=ALL`), no privilege escalation (`--security-opt=no-new-privileges`), and the source directory is mounted **read-only**. Output always goes through a separate writable mount instead — even when you haven't set a custom output folder, in which case that mount happens to point at the same directory as the source, but Docker keeps the two mounts (and their permissions) independent, so the container still can't write back into the read-only source mount. `pandoc.docker.options` is appended after these, so you can still override any of them if you have a specific need (for example, a Lua filter that fetches something over the network) — but note this means Docker options, like the executable path and Lua filters, are workspace-controlled settings that can influence what the container is allowed to do; see [Workspace Trust](#workspace-trust) below.

One consequence of the read-only source mount: if a Lua filter or other Pandoc extension tries to write a file next to your input document (rather than just producing the rendered output), that write will fail with a permission error inside the container. Use the writable output folder for anything that needs to be written, or set `pandoc.docker.options` to add your own writable mount if you have a specific filter that needs one.

When using Docker, there may be file permission issues with the docker image. When a render fails, the popup notification stays short ("pandoc: rendering failed. See the Pandoc output channel for details.") and the full detail — stdout, stderr, and the underlying exec error — goes to the **Pandoc** output channel (View → Output, then select "Pandoc" from the dropdown). For example, a permission issue would show there as:

```
stderr: pandoc: file.html: openFile: permission denied (Permission denied)

exec error: Error: Command failed: docker run --rm --network=none --cap-drop=ALL --security-opt=no-new-privileges -v "/home/user/path:/data:ro" -v "/home/user/path:/output" pandoc/latex:3.10.0.0-ubuntu "file.md" -o "/output/file.html"
pandoc: file.html: openFile: permission denied (Permission denied)
```

This may occur due to incorrect file/directory permissions. To fix, run `id -u` and `id -g` in a terminal to find your user and group IDs, then set them explicitly:

```json
"pandoc.docker.options": ["--user", "1000:1000"]
```

(Docker options run through Node's `execFile` rather than a shell, so shell substitutions like `$(id -u)` aren't expanded — use the literal numeric IDs.)

If needed, you can also change the default Pandoc docker image using the `pandoc.docker.image` configuration setting.

## Workspace Trust

This extension executes the configured Pandoc executable, Docker, and Lua filters — all of which can be controlled by workspace settings and files — so it declares itself unsupported in [untrusted workspaces](https://code.visualstudio.com/api/extension-guides/workspace-trust) and refuses to run the render command until the workspace is trusted.

## Releases

- July 30th, 2026
  - Add configurable output folder via `pandoc.outputFolder` setting
  - Add per-render output folder prompt via `pandoc.render.promptForOutputFolder` setting
  - Docker support for custom output folders via additional volume mount
- March 12th, 2026
  - Dependency updates
  - Export options sorted by usage by default with a setting to override
- June 25th, 2025
  - Add option to specify a default export format
  - Add option to use keybindings to export to specific formats
  - Readme and settings overhaul
  - Dependency updates
- December 1st, 2023
  - Added pandoc.docker.options and pandoc.docker.image configurations
  - Existing pandoc.useDocker configuration will be migrated to new configuration
- June 21st, 2023
  - Package updates
  - Read me updates
  - Remove noisy console messages
  - Add Docker support
- May 10th, 2023
  - Package updates
  - Added build workflows
  - Read me updates
- October 6th, 2020
  - Add ability to specify pandoc binary thanks @feeper
  - Stops rendered document opening automatically thanks @bno93
- April 22nd, 2020
  - Shift to new fork
  - Expose further conversion options
- July 9, 2016
  - Update package.json and launch.json
  - Add PR #11
  - Add output of the error (use OutputChannel and showErrorMessage)
- January 17, 2016
  - Set pandoc options for document types
- January 16, 2016
  - Handling of the path that contains spaces
  - Add the open command (xdg-open) in linux

## Development

### Running Tests

This extension includes a test suite. To run the tests:

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests locally (opens VS Code Extension Host)
npm test

# Run tests in headless mode (useful for CI)
npm run test:headless

# Run tests on Linux with virtual framebuffer (CI)
npm run test:ci
```

### Test Structure

The test suite includes:

- **Configuration Tests**: PDF options, format options, executable paths.
- **Docker Configuration Tests**: Migration and execution scenarios.  
- **Platform-Specific Tests**: Cross-platform command handling.
- **Integration Tests**: Full workflow testing.
- **Error Handling Tests**: Missing dependencies, execution failures.

### Building

```bash
# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Package the extension
npm run package
```

### CI/CD

The project uses GitHub Actions for continuous integration:

- Tests run on Ubuntu, Windows, and macOS.
- Tests run on Node.js versions 18, 20, and 22.
- Automatic VSIX packaging and artifact upload.
