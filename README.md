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

## Settings

Override these options in the Pandoc extension settings section, or find `pandoc` in _settings.json_ and set the options.

### Override the default executable

Override this in the Pandoc extension settings section, or find `pandoc` in _settings.json_ and set the options.

- Executable / `pandoc.executable`: Path to the Pandoc executable.

  - Default: Gets the path from the system's PATH variable.

### Set the default output format

To set a default export format and bypass the format list prompt, set the `pandoc.defaultFormat` option in the settings.

### Set Keybindings to formats

You can set keybindings to specific formats in a _keybindings.json_ file. For example, to set a keybinding for exporting to PDF, add:

```json
{
  "key": "ctrl+alt+p",
  "command": "pandoc.export",
  "args": { "format": "pdf" }
}
```

Setting these skips the format selection prompt and directly exports to the specified format, but you can still use the default render command to choose a format from the list.

### Additional Pandoc command line options

Set additional command line options for each output format.

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

## Docker Options

Set the `pandoc.docker.enabled` option to `true` and the extension runs Pandoc in a container using the latest official [pandoc/latex](https://hub.docker.com/r/pandoc/latex) image. This could result in a delay the first time it runs, or after an update to the container while it pulls down the new image.

- Docker: Enabled / `pandoc.docker.enabled`: Enable running Pandoc in a Docker container.

  - Default: `false`

- Docker: Image / `pandoc.docker.image`: Specify the Docker image to use when running Pandoc in a container.

  - Default: "pandoc/latex:latest"

- Docker: Options / `pandoc.docker.options`: Additional options to pass to the Docker command when running Pandoc in a container.

When using Docker, there may be file permission issues with the docker image. For example:

```
stderr: pandoc: file.html: openFile: permission denied (Permission denied)

exec error: Error: Command failed: docker run --rm -v "/home/user/path:/data"  pandoc/latex:latest "file.md" -o "file.html"
pandoc: file.html: openFile: permission denied (Permission denied)
```

This may occur due to incorrect file/directory permissions. To fix, set the Docker uid/gid using the following:

`pandoc.docker.options`: "--user $(id -u):$(id -g)"

If needed, you can also change the default Pandoc docker image using the `pandoc.docker.image` configuration setting.

## Releases

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
