// Canonical catalogue of formats pandoc.render accepts: one source of truth
// for the quick pick, the runtime allowlist for `outputType` (command
// arguments, keybindings, command URIs, other extensions), the output file
// extension, and the `pandoc.<label>OptString` settings key. Previously this
// was three separate hand-maintained copies (the picker items, an extension
// switch, and a 29-case options switch).
export interface PandocFormat {
  label: string;
  description: string;
  /** Output file extension, without the leading dot. Defaults to `label` when omitted. */
  extension?: string;
  /** Whether Pandoc's --reference-doc applies to this writer (docx, odt, pptx only -- verified directly against pandoc, which errors looking up the file for these three and silently ignores the flag for every other format). */
  supportsReferenceDoc?: boolean;
}

export const SUPPORTED_FORMATS: PandocFormat[] = [
  { label: "pdf", description: "Render as pdf document" },
  { label: "docx", description: "Render as word document", supportsReferenceDoc: true },
  { label: "html", description: "Render as html document" },
  { label: "asciidoc", description: "Render as asciidoc document", extension: "adoc" },
  { label: "docbook", description: "Render as docbook document", extension: "xml" },
  { label: "epub", description: "Render as epub document" },
  { label: "rst", description: "Render as rst document" },
  { label: "odt", description: "Render as odt (OpenDocument Text) document", supportsReferenceDoc: true },
  { label: "pptx", description: "Render as pptx (PowerPoint) document", supportsReferenceDoc: true },
  { label: "latex", description: "Render as latex document", extension: "tex" },
  { label: "beamer", description: "Render as beamer (LaTeX presentation) document", extension: "tex" },
  { label: "rtf", description: "Render as rtf (Rich Text Format) document" },
  { label: "org", description: "Render as org (Emacs Org-mode) document" },
  { label: "mediawiki", description: "Render as mediawiki document" },
  { label: "textile", description: "Render as textile document" },
  { label: "dokuwiki", description: "Render as dokuwiki document" },
  { label: "jira", description: "Render as jira markup document" },
  { label: "ipynb", description: "Render as ipynb (Jupyter Notebook) document" },
  { label: "typst", description: "Render as typst document", extension: "typ" },
  { label: "plain", description: "Render as plain text document", extension: "txt" },
  { label: "gfm", description: "Render as gfm (GitHub-Flavored Markdown) document", extension: "md" },
  { label: "commonmark", description: "Render as commonmark document", extension: "md" },
  { label: "opml", description: "Render as opml document" },
  { label: "icml", description: "Render as icml (InDesign) document" },
  { label: "jats", description: "Render as jats (JATS XML) document", extension: "xml" },
  { label: "man", description: "Render as man (Unix man page) document" },
  { label: "texinfo", description: "Render as texinfo (GNU Texinfo) document", extension: "texi" },
  { label: "fb2", description: "Render as fb2 (FictionBook2) document" },
  { label: "revealjs", description: "Render as revealjs (Reveal.js presentation) document", extension: "html" },
];

const SUPPORTED_FORMATS_BY_LABEL = new Map(SUPPORTED_FORMATS.map((f) => [f.label, f]));

export function isSupportedFormat(format: string): boolean {
  return SUPPORTED_FORMATS_BY_LABEL.has(format);
}

export function getOutputFileExtension(format: string): string {
  return SUPPORTED_FORMATS_BY_LABEL.get(format)?.extension ?? format;
}

export function supportsReferenceDoc(format: string): boolean {
  return SUPPORTED_FORMATS_BY_LABEL.get(format)?.supportsReferenceDoc === true;
}
