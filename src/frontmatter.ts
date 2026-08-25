import * as yaml from "js-yaml";
import { parseShellArgs } from "./commandBuilder";

// Maps our internal `format` identifiers (the `pandoc.<format>OptString`
// keys, see formats.ts) to the corresponding R Markdown `output:` block key,
// for the subset of formats where that mapping is unambiguous. Formats left
// out (e.g. "latex", which R Markdown has no dedicated output type for; or
// "commonmark", which "md_document" doesn't actually produce) are simply
// never matched against the `output:` block below, so `pandoc_args` there is
// ignored for them, while the top-level `pandoc_args` key still works.
const RMARKDOWN_OUTPUT_KEYS: Partial<Record<string, string>> = {
  docx: "word_document",
  pdf: "pdf_document",
  html: "html_document",
  odt: "odt_document",
  pptx: "powerpoint_presentation",
  epub: "epub_document",
  beamer: "beamer_presentation",
  revealjs: "revealjs_presentation",
  gfm: "github_document",
};

// Pandoc itself accepts either `---` or `...` as the closing fence for a
// leading YAML metadata block, so both are recognized here too.
export function extractFrontmatter(documentText: string): string | undefined {
  const stripped = documentText.replace(/^\uFEFF/, "");
  const match = /^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\r?\n?/.exec(stripped);
  return match ? match[1] : undefined;
}

// A `pandoc_args` value can be a single string (split like an OptString
// setting) or a YAML list, where each entry is already a discrete argument
// and is passed through as-is.
function normalizeArgsValue(value: unknown): string[] {
  if (typeof value === "string") {
    return parseShellArgs(value);
  }
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  return [];
}

/**
 * Extracts extra Pandoc CLI arguments from a document's YAML frontmatter for
 * the given output format. Recognizes a top-level `pandoc_args` key, and
 * (for the formats in RMARKDOWN_OUTPUT_KEYS) the R Markdown-style
 * `output.<format>.pandoc_args` block, e.g.
 *
 *   output:
 *     word_document:
 *       pandoc_args: ["--toc"]
 *
 * Returns an empty array if there is no frontmatter, it isn't valid YAML, or
 * it doesn't contain either key -- this is best-effort enrichment, not a
 * required part of the render.
 */
export function getInFileArgs(documentText: string, format: string): string[] {
  const frontmatter = extractFrontmatter(documentText);
  if (!frontmatter) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(frontmatter);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") {
    return [];
  }

  const doc = parsed as Record<string, unknown>;
  const args: string[] = [...normalizeArgsValue(doc.pandoc_args)];

  const rmdKey = RMARKDOWN_OUTPUT_KEYS[format];
  if (rmdKey && doc.output && typeof doc.output === "object") {
    const outputBlock = (doc.output as Record<string, unknown>)[rmdKey];
    if (outputBlock && typeof outputBlock === "object") {
      args.push(
        ...normalizeArgsValue((outputBlock as Record<string, unknown>).pandoc_args)
      );
    }
  }

  return args;
}
