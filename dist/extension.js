/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "child_process":
/*!********************************!*\
  !*** external "child_process" ***!
  \********************************/
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("path");

/***/ }),

/***/ "vscode":
/*!*************************!*\
  !*** external "vscode" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("vscode");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!**************************!*\
  !*** ./src/extension.ts ***!
  \**************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   activate: () => (/* binding */ activate)
/* harmony export */ });
/* harmony import */ var vscode__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! vscode */ "vscode");
/* harmony import */ var vscode__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(vscode__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var child_process__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! child_process */ "child_process");
/* harmony import */ var child_process__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(child_process__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! path */ "path");
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_2__);



var pandocOutputChannel = vscode__WEBPACK_IMPORTED_MODULE_0__.window.createOutputChannel("Pandoc");
function setStatusBarText(what, docType) {
    var date = new Date();
    var text = what + " [" + docType + "] " + date.toLocaleTimeString();
    vscode__WEBPACK_IMPORTED_MODULE_0__.window.setStatusBarMessage(text, 1500);
}
function parseShellArgs(input) {
    const args = [];
    let current = "";
    let i = 0;
    while (i < input.length) {
        const ch = input[i];
        if (ch === '"' || ch === "'") {
            const quote = ch;
            let closingQuoteIndex = i + 1;
            while (closingQuoteIndex < input.length && input[closingQuoteIndex] !== quote) {
                closingQuoteIndex++;
            }
            if (closingQuoteIndex >= input.length) {
                current += ch;
                i++;
            }
            else {
                i++;
                while (i < input.length && input[i] !== quote) {
                    current += input[i];
                    i++;
                }
                i++; // skip closing quote
            }
        }
        else if (/\s/.test(ch)) {
            if (current.length > 0) {
                args.push(current);
                current = "";
            }
            i++;
        }
        else {
            current += ch;
            i++;
        }
    }
    if (current.length > 0) {
        args.push(current);
    }
    return args;
}
function getOutputFileExtension(format) {
    var _a;
    const extensionMap = {
        "asciidoc": "adoc",
        "beamer": "tex",
        "commonmark": "md",
        "docbook": "xml",
        "gfm": "md",
        "jats": "xml",
        "latex": "tex",
        "plain": "txt",
        "revealjs": "html",
        "texinfo": "texi",
        "typst": "typ",
    };
    return (_a = extensionMap[format]) !== null && _a !== void 0 ? _a : format;
}
function getPandocOptions(quickPickLabel) {
    var pandocOptions;
    switch (quickPickLabel) {
        case "pdf":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("pdfOptString");
            break;
        case "docx":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("docxOptString");
            break;
        case "html":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("htmlOptString");
            break;
        case "asciidoc":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("asciidocOptString");
            break;
        case "docbook":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("docbookOptString");
            break;
        case "epub":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("epubOptString");
            break;
        case "rst":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("rstOptString");
            break;
        case "odt":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("odtOptString");
            break;
        case "pptx":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("pptxOptString");
            break;
        case "latex":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("latexOptString");
            break;
        case "beamer":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("beamerOptString");
            break;
        case "rtf":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("rtfOptString");
            break;
        case "org":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("orgOptString");
            break;
        case "mediawiki":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("mediawikiOptString");
            break;
        case "textile":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("textileOptString");
            break;
        case "dokuwiki":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("dokuwikiOptString");
            break;
        case "jira":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("jiraOptString");
            break;
        case "ipynb":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("ipynbOptString");
            break;
        case "typst":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("typstOptString");
            break;
        case "plain":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("plainOptString");
            break;
        case "gfm":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("gfmOptString");
            break;
        case "commonmark":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("commonmarkOptString");
            break;
        case "opml":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("opmlOptString");
            break;
        case "icml":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("icmlOptString");
            break;
        case "jats":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("jatsOptString");
            break;
        case "man":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("manOptString");
            break;
        case "texinfo":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("texinfoOptString");
            break;
        case "fb2":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("fb2OptString");
            break;
        case "revealjs":
            pandocOptions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("revealjsOptString");
            break;
    }
    return pandocOptions;
}
function openDocument(outFile) {
    switch (process.platform) {
        case "darwin":
            (0,child_process__WEBPACK_IMPORTED_MODULE_1__.execFile)("open", [outFile]);
            break;
        case "linux":
            (0,child_process__WEBPACK_IMPORTED_MODULE_1__.execFile)("xdg-open", [outFile]);
            break;
        default:
            (0,child_process__WEBPACK_IMPORTED_MODULE_1__.execFile)(outFile, []);
    }
}
function getPandocExecutablePath() {
    // By default pandoc executable should be in the PATH environment variable.
    var pandocExecutablePath;
    if (vscode__WEBPACK_IMPORTED_MODULE_0__.workspace.getConfiguration("pandoc").has("executable") &&
        vscode__WEBPACK_IMPORTED_MODULE_0__.workspace.getConfiguration("pandoc").get("executable") !== "") {
        pandocExecutablePath = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
            .getConfiguration("pandoc")
            .get("executable");
    }
    return pandocExecutablePath;
}
function getLuaFilterPaths(extensionPath) {
    var luaFilters = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
        .getConfiguration("pandoc")
        .get("luaFilters", []);
    var filters = luaFilters ? [...luaFilters] : [];
    var enableAdmonitions = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
        .getConfiguration("pandoc")
        .get("enableAdmonitions", false);
    if (enableAdmonitions && extensionPath) {
        var admonitionFilter = path__WEBPACK_IMPORTED_MODULE_2__.join(extensionPath, "filters", "docusaurus-admonitions.lua");
        filters.unshift(admonitionFilter);
    }
    return filters;
}
function getPandocDefaultFormat() {
    // TODO: Works, but seems to need a hard refresh.
    if (vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
        .getConfiguration("pandoc")
        .get("defaultOutputFormat").length > 0) {
        return vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
            .getConfiguration("pandoc")
            .get("defaultOutputFormat");
    }
    else {
        return undefined;
    }
}
function activate(context) {
    var disposable = vscode__WEBPACK_IMPORTED_MODULE_0__.commands.registerCommand("pandoc.render", (args) => {
        var defaultFormat = getPandocDefaultFormat();
        const editor = vscode__WEBPACK_IMPORTED_MODULE_0__.window.activeTextEditor;
        if (!editor) {
            return;
        }
        let fullName = path__WEBPACK_IMPORTED_MODULE_2__.normalize(editor.document.fileName);
        var filePath = path__WEBPACK_IMPORTED_MODULE_2__.dirname(fullName);
        var fileName = path__WEBPACK_IMPORTED_MODULE_2__.basename(fullName);
        var fileNameOnly = path__WEBPACK_IMPORTED_MODULE_2__.parse(fileName).name;
        var extensionPath = context.extensionPath;
        if (!defaultFormat && !(args === null || args === void 0 ? void 0 : args.outputType)) {
            // Nothing is set
            displayMenuAndRender(context, filePath, fileName, fileNameOnly, extensionPath);
        }
        else if ((args === null || args === void 0 ? void 0 : args.outputType) && !defaultFormat) {
            // If there is an output type selected, but no default format, then use the selected output type.
            renderDoc(filePath, fileName, fileNameOnly, args.outputType, extensionPath);
        }
        else if (args === null || args === void 0 ? void 0 : args.outputType) {
            // If the user has selected an output type, use that, overriding any default format.
            renderDoc(filePath, fileName, fileNameOnly, args.outputType, extensionPath);
        }
        else if (defaultFormat && !(args === null || args === void 0 ? void 0 : args.outputType)) {
            // Dfault format and no args, then use the default format.
            renderDoc(filePath, fileName, fileNameOnly, defaultFormat, extensionPath);
        }
    });
    context.subscriptions.push(disposable);
}
function displayMenuAndRender(context, filePath, fileName, fileNameOnly, extensionPath) {
    const sortByFrequency = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
        .getConfiguration("pandoc")
        .get("sortByFrequency", true);
    const usageCounts = context.globalState.get("pandoc.formatUsage", {});
    let items = [
        { label: "pdf", description: "Render as pdf document" },
        { label: "docx", description: "Render as word document" },
        { label: "html", description: "Render as html document" },
        { label: "asciidoc", description: "Render as asciidoc document" },
        { label: "docbook", description: "Render as docbook document" },
        { label: "epub", description: "Render as epub document" },
        { label: "rst", description: "Render as rst document" },
        { label: "odt", description: "Render as odt (OpenDocument Text) document" },
        { label: "pptx", description: "Render as pptx (PowerPoint) document" },
        { label: "latex", description: "Render as latex document" },
        { label: "beamer", description: "Render as beamer (LaTeX presentation) document" },
        { label: "rtf", description: "Render as rtf (Rich Text Format) document" },
        { label: "org", description: "Render as org (Emacs Org-mode) document" },
        { label: "mediawiki", description: "Render as mediawiki document" },
        { label: "textile", description: "Render as textile document" },
        { label: "dokuwiki", description: "Render as dokuwiki document" },
        { label: "jira", description: "Render as jira markup document" },
        { label: "ipynb", description: "Render as ipynb (Jupyter Notebook) document" },
        { label: "typst", description: "Render as typst document" },
        { label: "plain", description: "Render as plain text document" },
        { label: "gfm", description: "Render as gfm (GitHub-Flavored Markdown) document" },
        { label: "commonmark", description: "Render as commonmark document" },
        { label: "opml", description: "Render as opml document" },
        { label: "icml", description: "Render as icml (InDesign) document" },
        { label: "jats", description: "Render as jats (JATS XML) document" },
        { label: "man", description: "Render as man (Unix man page) document" },
        { label: "texinfo", description: "Render as texinfo (GNU Texinfo) document" },
        { label: "fb2", description: "Render as fb2 (FictionBook2) document" },
        { label: "revealjs", description: "Render as revealjs (Reveal.js presentation) document" },
    ];
    if (sortByFrequency) {
        // Sort by usage frequency (most used first); original order is preserved for ties.
        items.sort((a, b) => { var _a, _b; return ((_a = usageCounts[b.label]) !== null && _a !== void 0 ? _a : 0) - ((_b = usageCounts[a.label]) !== null && _b !== void 0 ? _b : 0); });
    }
    vscode__WEBPACK_IMPORTED_MODULE_0__.window.showQuickPick(items).then(async (qpSelection) => {
        var _a;
        if (!qpSelection) {
            return;
        }
        const updated = Object.assign(Object.assign({}, usageCounts), { [qpSelection.label]: ((_a = usageCounts[qpSelection.label]) !== null && _a !== void 0 ? _a : 0) + 1 });
        await context.globalState.update("pandoc.formatUsage", updated);
        renderDoc(filePath, fileName, fileNameOnly, qpSelection.label, extensionPath);
    });
}
function renderDoc(filePath, fileName, fileNameOnly, format, extensionPath) {
    var _a, _b, _c, _d, _e, _f;
    var inFile = path__WEBPACK_IMPORTED_MODULE_2__.join(filePath, fileName);
    var outExt = getOutputFileExtension(format);
    var outFile = path__WEBPACK_IMPORTED_MODULE_2__.join(filePath, fileNameOnly) + "." + outExt;
    setStatusBarText("Generating", format);
    var pandocOptions = getPandocOptions(format);
    var pandocExecutablePath = getPandocExecutablePath();
    var pandocConfigurations = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace.getConfiguration("pandoc");
    var deprecatedUseDockerGlobal = (_b = (_a = pandocConfigurations.inspect("useDocker")) === null || _a === void 0 ? void 0 : _a.globalValue) !== null && _b !== void 0 ? _b : undefined;
    if (deprecatedUseDockerGlobal !== undefined) {
        pandocOutputChannel.append('migrating global configuration "pandoc.useDocker" -> "pandoc.docker.enabled"\n');
        vscode__WEBPACK_IMPORTED_MODULE_0__.window.showWarningMessage('pandoc: found deprecated value in global configuration. Migrating configuration "pandoc.useDocker" -> "pandoc.docker.enabled".');
        pandocConfigurations.update("docker.enabled", deprecatedUseDockerGlobal, vscode__WEBPACK_IMPORTED_MODULE_0__.ConfigurationTarget.Global);
        pandocConfigurations.update("useDocker", undefined, vscode__WEBPACK_IMPORTED_MODULE_0__.ConfigurationTarget.Global);
    }
    var deprecatedUseDockerWorkspace = (_d = (_c = pandocConfigurations.inspect("useDocker")) === null || _c === void 0 ? void 0 : _c.workspaceValue) !== null && _d !== void 0 ? _d : undefined;
    if (deprecatedUseDockerWorkspace !== undefined) {
        pandocOutputChannel.append('migrating workspace configuration "pandoc.useDocker" -> "pandoc.docker.enabled"\n');
        vscode__WEBPACK_IMPORTED_MODULE_0__.window.showWarningMessage('pandoc: found deprecated value in workspace configuration. Migrating configuration "pandoc.useDocker" -> "pandoc.docker.enabled".');
        pandocConfigurations.update("docker.enabled", deprecatedUseDockerWorkspace, vscode__WEBPACK_IMPORTED_MODULE_0__.ConfigurationTarget.Workspace);
        pandocConfigurations.update("useDocker", undefined, vscode__WEBPACK_IMPORTED_MODULE_0__.ConfigurationTarget.Workspace);
    }
    var deprecatedUseDockerFolder = (_f = (_e = pandocConfigurations.inspect("useDocker")) === null || _e === void 0 ? void 0 : _e.workspaceFolderValue) !== null && _f !== void 0 ? _f : undefined;
    if (deprecatedUseDockerFolder !== undefined) {
        pandocOutputChannel.append('migrating folder configuration "pandoc.useDocker" -> "pandoc.docker.enabled"\n');
        vscode__WEBPACK_IMPORTED_MODULE_0__.window.showWarningMessage('pandoc: found deprecated value in folder configuration. Migrating configuration "pandoc.useDocker" -> "pandoc.docker.enabled".');
        pandocConfigurations.update("docker.enabled", deprecatedUseDockerFolder, vscode__WEBPACK_IMPORTED_MODULE_0__.ConfigurationTarget.WorkspaceFolder);
        pandocConfigurations.update("useDocker", undefined, vscode__WEBPACK_IMPORTED_MODULE_0__.ConfigurationTarget.WorkspaceFolder);
    }
    var useDocker = pandocConfigurations.get("docker.enabled");
    var dockerOptions = pandocConfigurations.get("docker.options");
    var dockerImage = pandocConfigurations.get("docker.image");
    var luaFilterPaths = getLuaFilterPaths(extensionPath);
    // Build command and argument list safely without going through a shell.
    var command;
    var args = [];
    if (useDocker) {
        command = "docker";
        args = [
            "run",
            "--rm",
            "-v",
            filePath + ":/data",
        ];
        // Mount each Lua filter into the container and rewrite paths
        luaFilterPaths.forEach((filterPath, i) => {
            var containerPath = "/filters/filter-" + i + ".lua";
            args.push("-v");
            args.push(filterPath + ":" + containerPath + ":ro");
        });
        if (dockerOptions) {
            args = args.concat(parseShellArgs(dockerOptions));
        }
        args.push(String(dockerImage));
        args.push(fileName);
        args.push("-o");
        args.push(fileNameOnly + "." + outExt);
        args.push("--to=" + format);
        if (pandocOptions) {
            args = args.concat(parseShellArgs(pandocOptions));
        }
        luaFilterPaths.forEach((_filterPath, i) => {
            args.push("--lua-filter");
            args.push("/filters/filter-" + i + ".lua");
        });
    }
    else {
        command = String(pandocExecutablePath);
        args.push(inFile);
        args.push("-o");
        args.push(outFile);
        args.push("--to=" + format);
        if (pandocOptions) {
            args = args.concat(parseShellArgs(pandocOptions));
        }
        luaFilterPaths.forEach((filterPath) => {
            args.push("--lua-filter");
            args.push(filterPath);
        });
    }
    (0,child_process__WEBPACK_IMPORTED_MODULE_1__.execFile)(command, args, { cwd: filePath }, function (error, stdout, stderr) {
        if (stdout !== null) {
            pandocOutputChannel.append(stdout.toString() + "\n");
        }
        if (stderr !== null) {
            if (stderr !== "") {
                vscode__WEBPACK_IMPORTED_MODULE_0__.window.showErrorMessage("stderr: " + stderr.toString());
                pandocOutputChannel.append("stderr: " + stderr.toString() + "\n");
            }
        }
        if (error !== null) {
            vscode__WEBPACK_IMPORTED_MODULE_0__.window.showErrorMessage("exec error: " + error);
            pandocOutputChannel.append("exec error: " + error + "\n");
        }
        else {
            var openViewer = vscode__WEBPACK_IMPORTED_MODULE_0__.workspace
                .getConfiguration("pandoc")
                .get("render.openViewer");
            if (openViewer) {
                setStatusBarText("Launching", format);
                openDocument(outFile);
            }
        }
    });
}

})();

module.exports = __webpack_exports__;
/******/ })()
;