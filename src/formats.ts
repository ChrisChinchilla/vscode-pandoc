// Canonical catalogue of formats pandoc.render accepts: one source of truth
// for the quick pick, the runtime allowlist for `outputType` (command
// arguments, keybindings, command URIs, other extensions), the output file
// extension, the `pandoc.<label>OptString` settings key and default, and
// reference-document support. Previously this was spread across separate
// hand-maintained picker, extension, options, and settings definitions.
export interface PandocFormat {
  label: string;
  description: string;
  /** Configuration key below the pandoc namespace for this writer's extra arguments. */
  optionKey: string;
  /** Runtime fallback, kept in sync with the contributed setting by tests. */
  defaultOptions: string;
  /** Output file extension, without the leading dot. Defaults to `label` when omitted. */
  extension?: string;
  /** Whether Pandoc's --reference-doc applies to this writer (docx, odt, pptx only -- verified directly against pandoc, which errors looking up the file for these three and silently ignores the flag for every other format). */
  supportsReferenceDoc?: boolean;
}

interface PandocFormatOptions {
  extension?: string;
  supportsReferenceDoc?: boolean;
  defaultOptions?: string;
}

function defineFormat(
  label: string,
  description: string,
  options: PandocFormatOptions = {}
): PandocFormat {
  return {
    label,
    description,
    optionKey: label + "OptString",
    defaultOptions: options.defaultOptions ?? "",
    extension: options.extension,
    supportsReferenceDoc: options.supportsReferenceDoc,
  };
}

export const SUPPORTED_FORMATS: PandocFormat[] = [
  defineFormat("pdf", "Render as pdf document"),
  defineFormat("docx", "Render as word document", { supportsReferenceDoc: true }),
  defineFormat("html", "Render as html document", { defaultOptions: "-s" }),
  defineFormat("asciidoc", "Render as asciidoc document", { extension: "adoc" }),
  defineFormat("docbook", "Render as docbook document", { extension: "xml", defaultOptions: "-s" }),
  defineFormat("epub", "Render as epub document"),
  defineFormat("rst", "Render as rst document"),
  defineFormat("odt", "Render as odt (OpenDocument Text) document", { supportsReferenceDoc: true }),
  defineFormat("pptx", "Render as pptx (PowerPoint) document", { supportsReferenceDoc: true }),
  defineFormat("latex", "Render as latex document", { extension: "tex", defaultOptions: "-s" }),
  defineFormat("beamer", "Render as beamer (LaTeX presentation) document", { extension: "tex", defaultOptions: "-s" }),
  defineFormat("rtf", "Render as rtf (Rich Text Format) document", { defaultOptions: "-s" }),
  defineFormat("org", "Render as org (Emacs Org-mode) document"),
  defineFormat("mediawiki", "Render as mediawiki document"),
  defineFormat("textile", "Render as textile document"),
  defineFormat("dokuwiki", "Render as dokuwiki document"),
  defineFormat("jira", "Render as jira markup document"),
  defineFormat("ipynb", "Render as ipynb (Jupyter Notebook) document"),
  defineFormat("typst", "Render as typst document", { extension: "typ" }),
  defineFormat("plain", "Render as plain text document", { extension: "txt" }),
  defineFormat("gfm", "Render as gfm (GitHub-Flavored Markdown) document", { extension: "md" }),
  defineFormat("commonmark", "Render as commonmark document", { extension: "md" }),
  defineFormat("opml", "Render as opml document", { defaultOptions: "-s" }),
  defineFormat("icml", "Render as icml (InDesign) document"),
  defineFormat("jats", "Render as jats (JATS XML) document", { extension: "xml" }),
  defineFormat("man", "Render as man (Unix man page) document"),
  defineFormat("texinfo", "Render as texinfo (GNU Texinfo) document", { extension: "texi", defaultOptions: "-s" }),
  defineFormat("fb2", "Render as fb2 (FictionBook2) document"),
  defineFormat("revealjs", "Render as revealjs (Reveal.js presentation) document", { extension: "html", defaultOptions: "-s" }),
];

const SUPPORTED_FORMATS_BY_LABEL = new Map(SUPPORTED_FORMATS.map((f) => [f.label, f]));

export function isSupportedFormat(format: string): boolean {
  return SUPPORTED_FORMATS_BY_LABEL.has(format);
}

export function getSupportedFormat(format: string): PandocFormat | undefined {
  return SUPPORTED_FORMATS_BY_LABEL.get(format);
}

export function getOutputFileExtension(format: string): string {
  return SUPPORTED_FORMATS_BY_LABEL.get(format)?.extension ?? format;
}

export function supportsReferenceDoc(format: string): boolean {
  return SUPPORTED_FORMATS_BY_LABEL.get(format)?.supportsReferenceDoc === true;
}
