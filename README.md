# vscode-pandoc

The vscode-pandoc [Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=chrischinchilla.vscode-pandoc) extension lets you convert Markdown and other supported source documents into 29 output formats, including PDF, Word, HTML, EPUB, and PowerPoint.

> Thanks to the previous work of [@dfinke](https://github.com/dfinke) on this extension.

![Rendering a document with vscode-pandoc](images/vscodePandoc.gif)

## Features

- Render the active document to any of [29 output formats](#supported-output-formats) from the Command Palette or a keybinding.
- Per-format Pandoc argument strings, plus optional in-file `pandoc_args` frontmatter.
- [Render on save](#render-on-save), with per-language scoping.
- [Named profiles](#profiles) for switching whole option sets per client or project.
- [Per-document reference templates](#document-templates) for `docx`, `odt`, and `pptx`.
- Built-in [admonition rendering](#admonition-support) (`:::note`, `:::warning`, …) via a bundled Lua filter, plus support for your own [Lua filters](#lua-filters).
- Optional [Docker mode](#docker-options) with hardened container defaults.
- A configurable [output folder](#set-the-output-folder), render timeout, and auto-open of the result.

## Commands

Run these from the Command Palette (_F1_ / _shift+cmd+P_):

| Command | Description |
|---------|-------------|
| **Pandoc Render** | Render the active document. Bound to _ctrl+K P_ (_cmd+K P_ on Mac). |
| **Pandoc: Select Profile** | Choose the active [profile](#profiles) for the workspace, or "Default" to use base settings. |

## Prerequisites

You need **Visual Studio Code 1.110 or newer** to run the extension.

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

Pandoc reads local files from disk, so the extension only works on saved documents in a real folder (not untitled buffers or virtual filesystems). If the document has unsaved changes, the extension saves it after you pick the format, then renders.

Rendering shows a cancellable progress notification. It times out after five minutes by default ([`pandoc.render.timeout`](#settings-reference)), and a second render to the same output waits for or is rejected until the first finishes.

By default, the extension saves the rendered file next to the source file, with the same name and an extension matching the format you picked (e.g. _notes.md_ -> _notes.html_). Read [Set the output folder](#set-the-output-folder) to change this. When rendering succeeds, the extension also opens the result in its default viewer automatically (`pandoc.render.openViewer`, on by default). Set it to `false` to disable this. If that step itself fails (no application associated with the file type, for example), a warning notification says so rather than failing silently.

### Supported output formats

Use the format identifier below for `pandoc.defaultOutputFormat` or a keybinding's `outputType`. Each format has its own setting for additional Pandoc arguments.

| Format identifier | Output extension | Options setting |
|-------------------|------------------|-----------------|
| `pdf` | `.pdf` | `pandoc.pdfOptString` |
| `docx` | `.docx` | `pandoc.docxOptString` |
| `html` | `.html` | `pandoc.htmlOptString` |
| `asciidoc` | `.adoc` | `pandoc.asciidocOptString` |
| `docbook` | `.xml` | `pandoc.docbookOptString` |
| `epub` | `.epub` | `pandoc.epubOptString` |
| `rst` | `.rst` | `pandoc.rstOptString` |
| `odt` | `.odt` | `pandoc.odtOptString` |
| `pptx` | `.pptx` | `pandoc.pptxOptString` |
| `latex` | `.tex` | `pandoc.latexOptString` |
| `beamer` | `.tex` | `pandoc.beamerOptString` |
| `rtf` | `.rtf` | `pandoc.rtfOptString` |
| `org` | `.org` | `pandoc.orgOptString` |
| `mediawiki` | `.mediawiki` | `pandoc.mediawikiOptString` |
| `textile` | `.textile` | `pandoc.textileOptString` |
| `dokuwiki` | `.dokuwiki` | `pandoc.dokuwikiOptString` |
| `jira` | `.jira` | `pandoc.jiraOptString` |
| `ipynb` | `.ipynb` | `pandoc.ipynbOptString` |
| `typst` | `.typ` | `pandoc.typstOptString` |
| `plain` | `.txt` | `pandoc.plainOptString` |
| `gfm` | `.md` | `pandoc.gfmOptString` |
| `commonmark` | `.md` | `pandoc.commonmarkOptString` |
| `opml` | `.opml` | `pandoc.opmlOptString` |
| `icml` | `.icml` | `pandoc.icmlOptString` |
| `jats` | `.xml` | `pandoc.jatsOptString` |
| `man` | `.man` | `pandoc.manOptString` |
| `texinfo` | `.texi` | `pandoc.texinfoOptString` |
| `fb2` | `.fb2` | `pandoc.fb2OptString` |
| `revealjs` | `.html` | `pandoc.revealjsOptString` |

## Settings

Override these options in the Pandoc extension settings section, or find `pandoc` in _settings.json_ and set the options.

### Override the default executable

Override this in the Pandoc extension settings section, or find `pandoc` in _settings.json_ and set the options.

- Executable / `pandoc.executable`: Path to the Pandoc executable.

  - Default: Gets the path from the system's PATH variable.

The extension calls Pandoc directly, using the `PATH` VS Code's own process has. It doesn't see shell aliases or `PATH` edits that only apply to interactive shells (asdf/nvm version managers, `brew shellenv`, etc.). If `pandoc: command not found` appears in the Pandoc output channel despite `pandoc` working in your terminal, set `pandoc.executable` to the absolute path from `which pandoc` (macOS/Linux) or `where.exe pandoc` (Windows).

### Set the default output format

To set a default export format and bypass the format list prompt, set the `pandoc.defaultOutputFormat` option in the settings.

The extension accepts only the formats in the format picker. If you set `pandoc.defaultOutputFormat` to anything else, the extension shows an error instead of rendering.

### Render on save

Set `pandoc.render.onSave` to `true` to automatically render every time you save a supported document (Markdown, AsciiDoc, XML, HTML, EPUB, or reStructuredText), instead of running **Pandoc Render** manually.

- Render on Save / `pandoc.render.onSave`: Automatically render to `pandoc.defaultOutputFormat` on every save.

  - Default: `false`

Render-on-save always targets `pandoc.defaultOutputFormat`. There's no separate format setting for it, and no format picker on save, since prompting on every keystroke-triggered save would be disruptive. **Set `pandoc.defaultOutputFormat`** before using render-on-save. If you enable `pandoc.render.onSave` without it, the extension shows one warning (not one per save) explaining that you need to choose a format, and does not render.

Example `settings.json`:

```json
{
  "pandoc.defaultOutputFormat": "pdf",
  "pandoc.render.onSave": true
}
```

Unlike a manual render, render-on-save does **not** show the "file already exists, overwrite?" prompt, or the output-folder input box even if you enable `pandoc.render.promptForOutputFolder`. It silently renders to the configured (or default) output folder and overwrites the previous output on every save. Combine with [`pandoc.outputFolder`](#set-the-output-folder) or a [profile](#profiles) if you'd rather the file that each save overwrites live somewhere other than next to your source document.

Rapid saves while a render is still running are collapsed into a single trailing render rather than piling up concurrent Pandoc processes.

Because this is a VS Code setting, you can scope it to specific languages or folders using VS Code's own [language-specific settings](https://code.visualstudio.com/docs/configure/settings#_language-specific-editor-settings) rather than any custom configuration in this extension. For example, to enable it only for Markdown files:

```json
{
  "[markdown]": {
    "pandoc.render.onSave": true
  },
  "pandoc.defaultOutputFormat": "html"
}
```

The same applies to `pandoc.defaultOutputFormat` itself, if you want different saved formats for different languages.

### Overwriting existing files

If the output file already exists, the extension asks before overwriting it. If the output path would be identical to the source file (e.g. exporting Markdown as `gfm`, or HTML as `html`), it refuses to run — rename the file or pick a different format.

### Set the output folder

By default, the extension saves rendered files in the same directory as the source file. You can configure a different output location:

- Output Folder / `pandoc.outputFolder`: Default output folder for rendered files. Supports absolute paths. Leave empty to save output alongside the source file.

  - Default: `""` (empty, saves output in the same directory as the source file)

- Prompt for Output Folder / `pandoc.render.promptForOutputFolder`: Enable this option to show an input box before each render so you can specify (or confirm) the output folder. If you set `pandoc.outputFolder`, the extension pre-fills the box with that value.

  - Default: `false`

Example `settings.json` to always output to a fixed folder:

```json
{
  "pandoc.outputFolder": "/home/user/documents/rendered"
}
```

Example `settings.json` to prompt you for the output folder on every render:

```json
{
  "pandoc.render.promptForOutputFolder": true
}
```

You can combine both: set `pandoc.outputFolder` as a convenient default that the prompt pre-fills, while still allowing you to override it per run.

### Document templates

For formats Pandoc supports a style-reference template for (`docx`, `odt`, `pptx`, via [`--reference-doc`](https://pandoc.org/MANUAL.html#option--reference-doc)), you can give an individual document its own template with no settings.json editing at all: enable `pandoc.enableDocumentTemplates`, then place a file named `<document-name>.template.<format>` next to the source file.

```json
{
  "pandoc.enableDocumentTemplates": true
}
```

For example, when you render `report.md` to docx, the extension looks for `report.template.docx` in the same folder and uses it automatically if present. If it finds no template, it adds no `--reference-doc` argument and renders as usual. This is a lighter-weight alternative to [Profiles](#profiles) below for the common case of "this one document has its own template," rather than switching between named configurations for whole clients or projects. An explicit `--reference-doc` in `pandoc.<format>OptString`, a profile, or in-file args (see [Setting Pandoc arguments in the document itself](#setting-pandoc-arguments-in-the-document-itself)) always overrides the auto-detected template.

### Profiles

If you render documents for multiple clients or projects that each need different Pandoc options, for example, a different `--reference-doc` template per client, define named profiles instead of editing settings every time you switch:

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
- Run **Pandoc: Select Profile** from the Command Palette to choose the active profile (or "Default" to clear it and use the base settings). The extension remembers your choice for the current workspace, so you don't need to reselect it on every render. It only changes when you run the command again.
- The extension uses `pandoc.defaultProfile` the first time you render in a workspace, before you've explicitly picked a profile with the command. It ignores this setting if it doesn't match a key in `pandoc.profiles`.
- While a profile is active, the status bar and the render progress notification show its name alongside the format (e.g. `Generating [docx] (client1)`).
- Leaving `pandoc.profiles` empty (the default) hides all profile UI.

### Sort formats by frequency

By default, the extension sorts the format selection list by how often you use each format, so your used formats appear at the top. You can disable this behaviour with the `pandoc.sortByFrequency` setting.

### Set Keybindings to formats

You can set keybindings to specific formats in a _keybindings.json_ file. For example, to set a keybinding for exporting to PDF, add:

```json
{
  "key": "ctrl+alt+p",
  "command": "pandoc.render",
  "args": { "outputType": "pdf" }
}
```

Setting these skips the format selection prompt and directly exports to the specified format, but you can still use the default render command to choose a format from the list. The extension validates `outputType` the same way as `pandoc.defaultOutputFormat`. If it does not recognize the value, it shows an error instead of rendering.

### Lua Filters

Pandoc supports [Lua filters](https://pandoc.org/lua-filters.html) that can transform the document AST during conversion. You can specify one or more Lua filter file paths using the `pandoc.luaFilters` setting.

- Lua Filters / `pandoc.luaFilters`: List of absolute paths to Lua filter files to pass to Pandoc via `--lua-filter`.

  - Default: `[]` (empty, applies no filters)

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

PDF output needs the LaTeX [`tcolorbox`](https://ctan.org/pkg/tcolorbox) package and its dependencies (`pgf`, `etoolbox`, `environ`, `trimspaces`, `verbatim`). A full TeX distribution (TeX Live, MacTeX) already includes these; minimal installs like BasicTeX may need them added. Other output formats have no extra requirements.

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

You can also add a custom title, via Pandoc's own fenced-div attribute syntax:

```markdown
::: {.warning title="Watch Out"}
This has a custom title.
:::
```

Use the attribute form above, not Docusaurus's inline bracket form (`:::warning[Watch Out]`) — Pandoc's Markdown reader doesn't recognise it as a fenced div.

#### Format-specific rendering

| Format | Rendering |
|--------|-----------|
| **PDF** | Colored `tcolorbox` boxes with title header. Requires the LaTeX `tcolorbox` package, which most TeX distributions include. |
| **HTML / EPUB** | Styled `<div>` elements with colored left border and background (uses inline CSS and needs no external stylesheet). |
| **DOCX** | Bold title paragraph with an "Admonition" custom style (you can customize this style in a reference document). |
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

Pandoc doesn't render [Mermaid](https://mermaid.js.org/) diagrams natively, but it can shell out to one via its generic `--filter` (`-F`) mechanism. This extension doesn't bundle Mermaid support, but you can set it up yourself:

1. Install [`mermaid-filter`](https://github.com/raghur/mermaid-filter) globally so it's on your `PATH`:

   ```sh
   npm install -g mermaid-filter
   ```

2. Add `-F mermaid-filter` to the `pandoc.<format>OptString` setting(s) for every output format in which you want to render diagrams (for example `pandoc.pdfOptString`, `pandoc.htmlOptString`, `pandoc.docxOptString`):

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

**Docker note:** if you use `pandoc.docker.enabled`, `-F mermaid-filter` won't work with the default `pandoc.docker.image`. That image doesn't include Node.js or `mermaid-filter`. You'd need to build and configure a custom image that includes both.

### Additional Pandoc command line options

Set additional command line options for each output format.

Some formats default to `-s` (`--standalone`) in this extension so Pandoc generates full documents by default. You can remove `-s` in settings if you want fragment output.

- Defaults to `-s`: `pandoc.htmlOptString`, `pandoc.docbookOptString`, `pandoc.latexOptString`, `pandoc.beamerOptString`, `pandoc.rtfOptString`, `pandoc.opmlOptString`, `pandoc.texinfoOptString`, `pandoc.revealjsOptString`
- Pandoc already enables standalone automatically for: PDF, EPUB, FB2, DOCX, ODT

> default: `$ pandoc inFile.md -o outFile.{pdf|docx|html}`

Use the `pandoc.<format>OptString` setting listed in [Supported output formats](#supported-output-formats) for your chosen output.

Below are example options you can set for each output format.

For example to create a Japanese PDF:

`pandoc.pdfOptString`: "--pdf-engine=lualatex -V documentclass=ltjarticle -V geometry:a4paper -V geometry:margin=2.5cm -V geometry:nohead"

To create an HTML5 document:

`pandoc.htmlOptString`: "-s -t html5"

> For more information, read the [Pandoc User's Guide](http://pandoc.org/README.html).

### Custom CSS and Pandoc defaults files

There's no dedicated setting for either of these, but both are Pandoc command line flags, so they work through the same `pandoc.<format>OptString` settings as any other option above.

**Custom CSS**, for HTML/EPUB/Reveal.js output, via [`--css`](https://pandoc.org/MANUAL.html#option--css):

```json
{
  "pandoc.htmlOptString": "-s --css=/path/to/style.css"
}
```

Repeat `--css` to include more than one stylesheet. It accepts a URL as well as a local path. Note that most browsers block `file://` stylesheet links for security reasons — if the rendered HTML doesn't pick up local CSS when you open it directly, either use `--embed-resources --standalone` (which inlines the CSS instead of linking it) or serve the file over `http://` rather than opening it from disk.

Pandoc resolves a relative `--css` path (and `--resource-path`, `--include-*`, etc.) relative to the **source file**, not the workspace root. To ease the common case of a shared `styles/` folder at the workspace root, the extension adds a `--resource-path` covering both the file's directory and the workspace root. This doesn't apply in Docker mode; an absolute path always works.

**Defaults files**, Pandoc's own [YAML-based option bundles](https://pandoc.org/MANUAL.html#default-files), via `--defaults` (or `-d`):

```json
{
  "pandoc.pdfOptString": "--defaults=/path/to/defaults.yaml"
}
```

A defaults file can set almost anything an OptString can (reader/writer options, variables, filters, metadata, resource paths) in one reusable, version-controllable file instead of a single-line string in settings. This is useful if your options are long, or you already maintain one for command-line use outside VS Code. Pandoc layers options from the OptString on top of the defaults file, so those options can override the defaults. If you need to switch between several such files per client/project rather than editing settings each time, see [Profiles](#profiles) above, which can point different profiles at different `--defaults` files (or templates, output folders, etc.) per format.

### Setting Pandoc arguments in the document itself

Normally every Pandoc CLI argument comes from extension settings (`pandoc.<format>OptString`, profiles, etc.), not from the source document. The extension ignores a `pandoc_args` entry in a document's own YAML frontmatter by default, even though it's a common way to set per-document options for R Markdown/Pandoc workflows outside this extension.

Set `pandoc.readInFileArgs` to `true` to opt in. When you enable this setting, the extension reads two shapes of frontmatter and appends whatever it finds after the matching `pandoc.<format>OptString`, so in-file values can override it.

A flat, extension-owned key:

```yaml
---
pandoc_args: ["--toc", "--number-sections"]
---
```

Or an R Markdown-style nested block that the extension matches to your current output format (`docx` → `word_document`, `pdf` → `pdf_document`, `html` → `html_document`, `odt` → `odt_document`, `pptx` → `powerpoint_presentation`, `epub` → `epub_document`, `beamer` → `beamer_presentation`, `revealjs` → `revealjs_presentation`, `gfm` → `github_document`):

```yaml
---
output:
  word_document:
    pandoc_args: ["--reference-doc=/path/to/template.docx"]
---
```

`pandoc_args` can also be a single string instead of a list, in which case the extension splits it the same way it splits an OptString. Formats with no corresponding R Markdown output type (e.g. `latex`) only pick up the flat top-level key.

This setting is off by default because it means Pandoc arguments come from file content rather than only from settings you control. Only enable it for workspaces/documents you trust, and note it has no effect in untrusted workspaces regardless, since the whole render command requires one.

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

  - Default: `[]`. An older single-string value is migrated to a list automatically on the next render.

Every Docker run gets hardened defaults: no network (`--network=none`), no capabilities (`--cap-drop=ALL`), no privilege escalation (`--security-opt=no-new-privileges`), and a read-only mount of the source directory with output written through a separate writable mount. `pandoc.docker.options` is appended after these, so it can override them if a filter genuinely needs, say, network access. Because these options control what the container can do, Docker mode requires a trusted workspace (see [Workspace Trust](#workspace-trust)).

A filter that writes files next to the source document fails with a permission error inside the container — point it at the writable output folder instead, or add your own mount via `pandoc.docker.options`.

**Permission errors:** if a render fails with `openFile: permission denied` in the Pandoc output channel (View → Output → "Pandoc"), run `id -u` and `id -g` and set your IDs explicitly. Docker options don't go through a shell, so use literal numbers, not `$(id -u)`:

```json
"pandoc.docker.options": ["--user", "1000:1000"]
```

## Workspace Trust

This extension executes the configured Pandoc executable, Docker, and Lua filters, all of which workspace settings and files can control, so it declares itself unsupported in [untrusted workspaces](https://code.visualstudio.com/api/extension-guides/workspace-trust) and refuses to run the render command until you trust the workspace.

## Settings reference

All settings live under the `pandoc.` prefix. Each output format also has its own `pandoc.<format>OptString` string (see [Supported output formats](#supported-output-formats)); the ones with a non-empty default are `-s`: `htmlOptString`, `docbookOptString`, `latexOptString`, `beamerOptString`, `rtfOptString`, `opmlOptString`, `texinfoOptString`, `revealjsOptString`.

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| `pandoc.executable` | string | `pandoc` | Path to the Pandoc executable. Empty/`pandoc` uses `PATH`. |
| `pandoc.defaultOutputFormat` | string (enum) | `""` | Render to this format and skip the picker. |
| `pandoc.defaultProfile` | string | `""` | Profile to use before one is chosen with the command. |
| `pandoc.profiles` | object | `{}` | Named per-client/project option sets. |
| `pandoc.outputFolder` | string | `""` | Output folder for rendered files. Empty = next to source. |
| `pandoc.render.promptForOutputFolder` | boolean | `false` | Prompt for the output folder before each render. |
| `pandoc.render.onSave` | boolean | `false` | Render to `defaultOutputFormat` on every save. |
| `pandoc.render.openViewer` | boolean | `true` | Open the result in its default viewer after a successful render. |
| `pandoc.render.timeout` | number | `300` | Max render time in seconds. `0` disables the timeout. |
| `pandoc.sortByFrequency` | boolean | `true` | Sort the format picker by how often you use each format. |
| `pandoc.luaFilters` | string[] | `[]` | Absolute paths of Lua filters to pass via `--lua-filter`. |
| `pandoc.enableAdmonitions` | boolean | `false` | Enable the bundled admonition Lua filter. |
| `pandoc.enableDocumentTemplates` | boolean | `false` | Auto-use `<name>.template.<format>` next to the source. |
| `pandoc.readInFileArgs` | boolean | `false` | Read `pandoc_args` from the document's own frontmatter. |
| `pandoc.docker.enabled` | boolean | `false` | Run Pandoc in a container instead of locally. |
| `pandoc.docker.image` | string | `pandoc/latex:3.10.0.0-ubuntu` | Image to use in Docker mode. |
| `pandoc.docker.options` | string[] | `[]` | Extra `docker run` arguments (list form). |

`pandoc.useDocker` is deprecated — use `pandoc.docker.enabled`.

## Releases

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Issues and contributing

Report bugs and request features on the [issue tracker](https://github.com/chrischinchilla/vscode-pandoc/issues). See [contributing.md](contributing.md) for development setup, debugging, tests, packaging, CI/CD, and the release process.

## Licence

MIT — see [License](License).
