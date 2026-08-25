import * as assert from 'assert';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Real end-to-end tests: these run the actual `pandoc` binary and the actual
// bundled Lua filter (no VS Code, no mocking), and assert on genuine output
// content. Unlike the rest of the suite (which only checks the argument list
// a mocked execFile receives), this is what actually caught two real bugs:
// the documented Docusaurus bracket-title syntax not being valid Pandoc
// fenced-div syntax at all, and the DocBook renderer tagging its RawBlock
// "docbook5" when Pandoc's writer only honors the generic "docbook" tag,
// silently dropping every admonition from DocBook output.
//
// PDF is checked via `--to=latex` (the same LaTeX Pandoc would hand to the
// PDF engine) rather than actually compiling to PDF, so this suite has no
// dependency on a TeX installation. Skips entirely if `pandoc` isn't on PATH.
suite('Admonition Format Integration Tests', function () {
    // Each test spawns one or more real pandoc processes (some do two,
    // chained). Mocha's default 2000ms per-test timeout is tuned for the
    // rest of this suite (a stubbed execFile, effectively instant) and is
    // too tight for genuine subprocess spawns under CI load -- this flaked
    // on macos-latest with Node 20 specifically (every other OS/Node
    // combination in the same run passed) with "Timeout of 2000ms exceeded".
    this.timeout(15000);

    const filterPath = path.resolve(__dirname, '../../../filters/docusaurus-admonitions.lua');
    let tmpDir: string;
    let inputFile: string;
    let pandocAvailable = true;

    const fixture = [
        '# Test document',
        '',
        ':::note',
        'This is a note with **bold** text.',
        ':::',
        '',
        '::: {.tip title="Custom Title"}',
        'Helpful tip here.',
        ':::',
        '',
        ':::warning',
        'Be careful!',
        ':::',
        '',
        ':::danger',
        'Critical warning.',
        ':::',
        '',
    ].join('\n');

    suiteSetup(function () {
        try {
            execFileSync('pandoc', ['--version'], { stdio: 'ignore' });
        } catch {
            pandocAvailable = false;
            return;
        }
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-pandoc-admonition-'));
        inputFile = path.join(tmpDir, 'doc.md');
        fs.writeFileSync(inputFile, fixture, 'utf8');
    });

    suiteTeardown(() => {
        if (tmpDir) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    function renderToFile(format: string, extraArgs: string[] = []): string {
        const outFile = path.join(tmpDir, 'out.' + format.replace(/\W/g, '_'));
        execFileSync(
            'pandoc',
            [inputFile, '--to=' + format, '--lua-filter', filterPath, ...extraArgs, '-o', outFile],
            { cwd: tmpDir }
        );
        return outFile;
    }

    function renderToText(format: string, extraArgs: string[] = []): string {
        const outFile = renderToFile(format, extraArgs);
        return fs.readFileSync(outFile, 'utf8');
    }

    test('HTML: renders styled divs with the resolved title, including a custom title', function () {
        if (!pandocAvailable) { this.skip(); return; }
        const html = renderToText('html');
        assert.ok(html.includes('class="admonition admonition-note"'), 'note div missing');
        assert.ok(html.includes('class="admonition admonition-tip"'), 'tip div missing');
        assert.ok(html.includes('>Custom Title<'), 'custom title not rendered');
        assert.ok(html.includes('class="admonition admonition-warning"'), 'warning div missing');
        assert.ok(html.includes('class="admonition admonition-danger"'), 'danger div missing');
    });

    test('DOCX: applies the Admonition custom-style and preserves the custom title', function () {
        if (!pandocAvailable) { this.skip(); return; }
        const docxFile = renderToFile('docx');
        // docx's own custom paragraph style only round-trips back out through
        // Pandoc's reader with the `+styles` extension -- this is genuinely
        // reading the produced .docx back, not just checking it's non-empty.
        // `-t markdown` (not `native`) keeps prose text contiguous instead of
        // splitting it across per-word AST nodes in the pretty-printed dump.
        const roundTripped = execFileSync(
            'pandoc',
            ['-f', 'docx+styles', docxFile, '-t', 'markdown'],
            { cwd: tmpDir }
        ).toString('utf8');
        assert.ok(roundTripped.includes('custom-style="Admonition"'), 'Admonition custom-style missing');
        assert.ok(roundTripped.includes('Custom Title'), 'custom title missing');
    });

    test('RST: uses native admonition directives with the resolved title', function () {
        if (!pandocAvailable) { this.skip(); return; }
        const rst = renderToText('rst');
        assert.ok(rst.includes('.. note::'), 'note directive missing');
        assert.ok(rst.includes('.. tip:: Custom Title'), 'tip directive with custom title missing');
        assert.ok(rst.includes('.. warning::'), 'warning directive missing');
        assert.ok(rst.includes('.. danger::'), 'danger directive missing');
    });

    test('AsciiDoc: uses native admonition blocks with the resolved title', function () {
        if (!pandocAvailable) { this.skip(); return; }
        const adoc = renderToText('asciidoc');
        assert.ok(adoc.includes('[NOTE]'), 'NOTE block missing');
        assert.ok(adoc.includes('[TIP]') && adoc.includes('.Custom Title'), 'TIP block with custom title missing');
        assert.ok(adoc.includes('[WARNING]'), 'WARNING block missing');
        assert.ok(adoc.includes('[CAUTION]'), 'CAUTION block missing (danger maps to CAUTION)');
    });

    test('DocBook: emits native admonition elements (regression test for the dropped-RawBlock bug)', function () {
        if (!pandocAvailable) { this.skip(); return; }
        const docbook = renderToText('docbook');
        // Previously these were silently dropped entirely: the filter tagged
        // its RawBlock "docbook5", which Pandoc's docbook5 writer does not
        // pass through (only the generic "docbook" tag is honored), so the
        // output contained only the document's own heading.
        assert.ok(docbook.includes('<note>'), 'note element missing');
        assert.ok(docbook.includes('<tip>') && docbook.includes('<title>Custom Title</title>'), 'tip element with custom title missing');
        assert.ok(docbook.includes('<warning>'), 'warning element missing');
        assert.ok(docbook.includes('<caution>'), 'caution element missing (danger maps to caution)');
    });

    test('PDF (via LaTeX source): emits tcolorbox blocks with per-type colors and the resolved title', function () {
        if (!pandocAvailable) { this.skip(); return; }
        // Checks the LaTeX Pandoc would hand to the PDF engine, not an actual
        // compiled PDF -- verifies the filter's own output, not the reader's
        // TeX installation.
        const latex = renderToText('latex', ['-s']);
        assert.ok(latex.includes('\\usepackage{tcolorbox}'), 'tcolorbox package not injected');
        assert.ok(latex.includes('\\definecolor{admonnoteborder}'), 'note color definitions missing');
        assert.ok(latex.includes('\\definecolor{admontipborder}'), 'tip color definitions missing');
        assert.ok(latex.includes('\\definecolor{admonwarningborder}'), 'warning color definitions missing');
        assert.ok(latex.includes('\\definecolor{admondangerborder}'), 'danger color definitions missing');
        assert.ok(latex.includes('title={\\textbf{Custom Title}}'), 'custom title not rendered into tcolorbox');
        const boxCount = (latex.match(/\\begin\{tcolorbox\}/g) ?? []).length;
        assert.strictEqual(boxCount, 4, 'expected one tcolorbox per admonition, got ' + boxCount);
    });

    test("documented limitation: Docusaurus's :::type[Title] bracket form is not valid Pandoc fenced-div syntax", function () {
        if (!pandocAvailable) { this.skip(); return; }
        const bracketFile = path.join(tmpDir, 'bracket.md');
        fs.writeFileSync(bracketFile, ':::tip[Custom Title]\nHelpful tip here.\n:::\n', 'utf8');
        const html = execFileSync(
            'pandoc',
            [bracketFile, '--to=html', '--lua-filter', filterPath],
            { cwd: tmpDir }
        ).toString('utf8');
        // Pandoc's reader never produces a Div for this input at all, so the
        // filter never runs on it -- it passes through as a literal paragraph.
        // See the README's Admonition support section for the syntax that
        // does work: `::: {.tip title="Custom Title"}`.
        assert.ok(!html.includes('admonition'), 'expected no admonition styling for unrecognized bracket syntax');
        assert.ok(html.includes(':::tip[Custom Title]'), 'expected the literal unrecognized syntax to pass through as text');
    });
});
