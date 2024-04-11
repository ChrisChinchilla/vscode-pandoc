# vscode-pandoc

The vscode-pandoc [Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=chrischinchilla.vscode-pandoc) extension lets you render markdown files as a PDF, word document, or html file.

_Thanks to the previous work of [@dfinke](https://github.com/dfinke) on this extension._

## Prerequisites

You need to [**install Pandoc**](http://pandoc.org/installing.html) - a universal document converter.

Alternatively you may set the `useDocker` option to true and the extension runs Pandoc in a container using the latest official [pandoc/latex](https://hub.docker.com/r/pandoc/latex) image. This could result in a delay the first time it runs, or after an update to the container while it pulls down the new image.

## Usage

Two ways to run the extension. You need to have a markdown file open.

1. press `F1` on Windows (`shift+cmd+P` on Mac), type `pandoc`, press `Enter`
1. Or - press the key commination `ctrl+K` then `P` (`cmd+K` then `P` on Mac)

Choose from the list what document type you want to render and press `enter` (you can also type in the box rather than cursor around).

## Releases

* December 1st, 2023
  * Added pandoc.docker.options and pandoc.docker.image configurations
  * Existing pandoc.useDocker configuration will be migrated to new configuration
* June 21st, 2023
  * Package updates
  * Read me updates
  * Remove noisy console messages
  * Add Docker support
* May 10th, 2023
  * Package updates
  * Added build workflows
  * Read me updates
* October 6th, 2020
  * Add ability to specify pandoc binary thanks @feeper
  * Stops rendered document opening automatically thanks @bno93
* April 22nd, 2020
  * Shift to new fork
  * Expose further conversion options
* July 9, 2016
  * Update package.json and launch.json
  * Add PR #11
  * Add output of the error (use OutputChannel and showErrorMessage)
* January 17, 2016
  * Set pandoc options for document types
* January 16, 2016
  * Handling of the path that contains spaces
  * Add the open command (xdg-open) in linux

## Setting additional pandoc options

Find `pandoc` in _settings.json_ and add the options you want to use. For example:

example:

```json
//-------- Pandoc Option Configuration --------

// pandoc .pdf output option template that you would like to use
"pandoc.pdfOptString": "",

// pandoc .docx output option template that you would like to use
"pandoc.docxOptString": "",

// pandoc .html output option template that you would like to use
"pandoc.htmlOptString": "",

// path to the pandoc executable. By default gets from PATH variable
"pandoc.executable": "",

// enable running pandoc in a docker container
"pandoc.docker.enabled": "true",

// specify the docker options when "pandoc.docker.enabled" is "true"
"pandoc.docker.options": "",

// specify the docker image when "pandoc.docker.enabled" is "true"
"pandoc.docker.image": ""
```

You can set options for each output format.

> default: `$ pandoc inFile.md -o outFile.{pdf|word|html}`

For example, for Japanese documents.

* PDF

  `"pandoc.pdfOptString": "--pdf-engine=lualatex -V documentclass=ltjarticle -V geometry:a4paper -V geometry:margin=2.5cm -V geometry:nohead",`

  * `--pdf-engine=lualatex`: need to create a Japanese PDF
  * `-V documentclass=ltjarticle`: need to create a Japanese PDF
  * `-V geometry:a4paper -V geometry:margin=2.5cm -V geometry:nohead"`: geometory options

* Word(docx)

  `pandoc.docxOptString": "",`
  * It will work even if you do not set the options.

* HTML5

  `"pandoc.htmlOptString": "-s -t html5"`

  * `-s`: produce a standalone document
  * `-t html5`: HTML5 output format

For more information please refer to the [Pandoc User's Guide](http://pandoc.org/README.html).

## Docker Options

When running on linux systems (and possibly others) when using the docker, there may be file permission issues with the docker image. This can appear as an error such as the following:

```
stderr: pandoc: file.html: openFile: permission denied (Permission denied)

exec error: Error: Command failed: docker run --rm -v "/home/user/path:/data"  pandoc/latex:latest "file.md" -o "file.html"
pandoc: file.html: openFile: permission denied (Permission denied)
```

This may occur due to the file/directory permissions being incorrect. To allow this to function, you can specify the docker options to set the uid/gid using the following:

```json
  "pandoc.docker.options": "--user $(id -u):$(id -g)"
```

If needed, you can also change the default pandoc docker image using the `pandoc.docker.image` configuration setting.

