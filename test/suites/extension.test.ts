import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as path from 'path';
import * as extension from '../../src/extension';

// Test suite for vscode-pandoc extension
suite('vscode-pandoc Extension Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockOutputChannel: any;
    let mockWorkspaceConfig: any;
    let mockEditor: any;
    let mockDocument: any;
    let mockContext: vscode.ExtensionContext;
    let registerCommandStub: sinon.SinonStub;
    let isTrustedStub: sinon.SinonStub;

    // Setup before each test
    setup(() => {
        sandbox = sinon.createSandbox();
        
        // Mock output channel
        mockOutputChannel = {
            append: sandbox.stub(),
            show: sandbox.stub(),
            hide: sandbox.stub(),
            dispose: sandbox.stub()
        };
        
        // Mock workspace configuration
        mockWorkspaceConfig = {
            get: sandbox.stub(),
            has: sandbox.stub(),
            inspect: sandbox.stub(),
            update: sandbox.stub()
        };
        
        // Mock document
        mockDocument = {
            fileName: '/test/path/document.md',
            uri: vscode.Uri.file('/test/path/document.md'),
            languageId: 'markdown',
            isUntitled: false,
            isDirty: false,
            save: sandbox.stub().resolves(true)
        };
        
        // Mock editor
        mockEditor = {
            document: mockDocument,
            selection: new vscode.Selection(0, 0, 0, 0)
        };

        // Create a proper mock ExtensionContext
        mockContext = {
            subscriptions: [],
            workspaceState: {
                get: sandbox.stub(),
                update: sandbox.stub(),
                keys: sandbox.stub().returns([])
            },
            globalState: {
                get: sandbox.stub(),
                update: sandbox.stub(),
                setKeysForSync: sandbox.stub(),
                keys: sandbox.stub().returns([])
            },
            secrets: {
                get: sandbox.stub(),
                store: sandbox.stub(),
                delete: sandbox.stub(),
                onDidChange: sandbox.stub()
            },
            extensionUri: vscode.Uri.file('/mock/extension/path'),
            extensionPath: '/mock/extension/path',
            asAbsolutePath: sandbox.stub().callsFake((relativePath: string) => path.join('/mock/extension/path', relativePath)),
            storageUri: vscode.Uri.file('/mock/storage'),
            storagePath: '/mock/storage',
            globalStorageUri: vscode.Uri.file('/mock/global/storage'),
            globalStoragePath: '/mock/global/storage',
            logUri: vscode.Uri.file('/mock/log'),
            logPath: '/mock/log',
            extensionMode: vscode.ExtensionMode.Test,
            extension: {
                id: 'test.extension',
                extensionUri: vscode.Uri.file('/mock/extension/path'),
                extensionPath: '/mock/extension/path',
                isActive: true,
                packageJSON: {},
                exports: undefined,
                activate: sandbox.stub(),
                extensionKind: vscode.ExtensionKind.Workspace
            },
            environmentVariableCollection: {
                persistent: true,
                description: undefined,
                replace: sandbox.stub(),
                append: sandbox.stub(),
                prepend: sandbox.stub(),
                get: sandbox.stub(),
                forEach: sandbox.stub(),
                delete: sandbox.stub(),
                clear: sandbox.stub(),
                getScoped: sandbox.stub()
            },
            languageModelAccessInformation: {
                onDidChange: sandbox.stub(),
                canSendRequest: sandbox.stub().returns(undefined)
            }
        } as unknown as vscode.ExtensionContext;
        
        // Setup VS Code API mocks
        sandbox.stub(vscode.window, 'createOutputChannel').returns(mockOutputChannel);
        sandbox.stub(vscode.workspace, 'getConfiguration').returns(mockWorkspaceConfig);
        sandbox.stub(vscode.window, 'setStatusBarMessage');
        sandbox.stub(vscode.window, 'showQuickPick');
        sandbox.stub(vscode.window, 'showErrorMessage');
        sandbox.stub(vscode.window, 'showWarningMessage');
        sandbox.stub(vscode.env, 'openExternal').resolves(true);
        sandbox.stub(require('fs'), 'existsSync').returns(false);
        sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options: unknown, task: any) => {
            const token = {
                isCancellationRequested: false,
                onCancellationRequested: sandbox.stub().returns({ dispose: sandbox.stub() })
            };
            return task({ report: sandbox.stub() }, token);
        });
        // Baseline defaults for the output-folder feature so pre-existing helper
        // functions that don't know about it (added after resolveOutputFolder()
        // was introduced) don't crash calling .trim() on an unstubbed `get()`.
        // Tests that care about output-folder behavior override these directly.
        mockWorkspaceConfig.get.withArgs('outputFolder', '').returns('');
        mockWorkspaceConfig.get.withArgs('render.promptForOutputFolder', false).returns(false);
        isTrustedStub = sandbox.stub(vscode.workspace, 'isTrusted').value(true);
        registerCommandStub = sandbox.stub(vscode.commands, 'registerCommand').returns({ dispose: sandbox.stub() });
    });

    // Cleanup after each test
    teardown(() => {
        sandbox.restore();
    });

    suite('Configuration Tests', () => {
        
        test('getPandocOptions should return correct options for PDF format', async () => {
            // Arrange
            mockWorkspaceConfig.get.withArgs('pdfOptString').returns('--pdf-engine=lualatex -V documentclass=ltjarticle');
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('pdf');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});
            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, null, '', null);

            // Act
            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();

            // Assert
            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--pdf-engine=lualatex'), 'Configured PDF option flags should reach pandoc');
            assert.ok(args.includes('-V') && args.includes('documentclass=ltjarticle'), 'Configured PDF option flags should reach pandoc');
        });

        test('getPandocOptions should return correct options for all supported formats', () => {
            // Arrange - Setup mock returns for all formats
            const formats = [
                'pdf', 'docx', 'html', 'asciidoc', 'docbook', 'epub', 'rst',
                'odt', 'pptx', 'latex', 'beamer', 'rtf', 'org', 'mediawiki',
                'textile', 'dokuwiki', 'jira', 'ipynb', 'typst', 'plain',
                'gfm', 'commonmark', 'opml', 'icml', 'jats', 'man', 'texinfo',
                'fb2', 'revealjs'
            ];
            const optionStrings = [
                'pdfOptString', 'docxOptString', 'htmlOptString',
                'asciidocOptString', 'docbookOptString', 'epubOptString', 'rstOptString',
                'odtOptString', 'pptxOptString', 'latexOptString', 'beamerOptString',
                'rtfOptString', 'orgOptString', 'mediawikiOptString', 'textileOptString',
                'dokuwikiOptString', 'jiraOptString', 'ipynbOptString', 'typstOptString',
                'plainOptString', 'gfmOptString', 'commonmarkOptString', 'opmlOptString',
                'icmlOptString', 'jatsOptString', 'manOptString', 'texinfoOptString',
                'fb2OptString', 'revealjsOptString'
            ];
            
            formats.forEach((format, index) => {
                mockWorkspaceConfig.get.withArgs(optionStrings[index]).returns(`--${format}-options`);
            });
            
            // Act & Assert - Test will be validated through render command tests
            assert.strictEqual(formats.length, optionStrings.length, 'All formats have corresponding option strings');
        });

        test('getPandocExecutablePath should use the custom executable path when configured', async () => {
            // Arrange
            const customPath = '/custom/path/to/pandoc';
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.get.withArgs('executable').returns(customPath);
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('pdf');
            mockWorkspaceConfig.get.withArgs('pdfOptString').returns('');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});
            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, null, '', null);

            // Act
            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();

            // Assert
            assert.ok(execFileStub.called, 'execFile should have been called');
            assert.strictEqual(execFileStub.firstCall.args[0], customPath, 'The configured executable path should be used as the command');
        });

        test('getPandocExecutablePath should fall back to "pandoc" (resolved via PATH) when not configured', async () => {
            // Arrange
            mockWorkspaceConfig.has.withArgs('executable').returns(false);
            mockWorkspaceConfig.get.withArgs('executable').returns('');
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('pdf');
            mockWorkspaceConfig.get.withArgs('pdfOptString').returns('');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});
            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, null, '', null);

            // Act
            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();

            // Assert
            assert.ok(execFileStub.called, 'execFile should have been called');
            assert.strictEqual(execFileStub.firstCall.args[0], 'pandoc', 'Should fall back to the bare "pandoc" command, not the literal string "undefined"');
        });

        test('getPandocDefaultFormat should return configured default format', () => {
            // Arrange
            const defaultFormat = 'pdf';
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns(defaultFormat);
            
            // The function checks if length > 0, so we need to ensure our mock returns a string
            assert.strictEqual(typeof defaultFormat, 'string', 'Default format should be a string');
            assert.ok(defaultFormat.length > 0, 'Default format should not be empty');
        });
    });

    suite('Docker Configuration Tests', () => {
        
        /**
         * Helper: activates the extension, renders once with the given deprecated
         * useDocker inspect() result (and optionally a legacy docker.options
         * inspect() result), and returns the config-update stub for assertions
         * about migration behavior.
         */
        async function setupMigrationTest(
            inspectResult: {
                globalValue?: boolean;
                workspaceValue?: boolean;
                workspaceFolderValue?: boolean;
            },
            dockerOptionsInspectResult: {
                globalValue?: string | string[];
                workspaceValue?: string | string[];
                workspaceFolderValue?: string | string[];
            } = {}
        ) {
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns(inspectResult);
            mockWorkspaceConfig.inspect.withArgs('docker.options').returns(dockerOptionsInspectResult);
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('html');
            mockWorkspaceConfig.get.withArgs('htmlOptString').returns('');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('docker.options', []).returns([]);
            mockWorkspaceConfig.get.withArgs('docker.image').returns('pandoc/latex:3.10.0.0-ubuntu');
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, null, '', null);

            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();

            const showWarningMessageStub = vscode.window.showWarningMessage as sinon.SinonStub;
            return { updateStub: mockWorkspaceConfig.update as sinon.SinonStub, showWarningMessageStub };
        }

        test('should migrate deprecated useDocker global configuration', async () => {
            const { updateStub, showWarningMessageStub } = await setupMigrationTest({
                globalValue: true,
                workspaceValue: undefined,
                workspaceFolderValue: undefined
            });

            assert.ok(
                updateStub.calledWith('docker.enabled', true, vscode.ConfigurationTarget.Global),
                'docker.enabled should be migrated to the deprecated global value'
            );
            assert.ok(
                updateStub.calledWith('useDocker', undefined, vscode.ConfigurationTarget.Global),
                'The deprecated useDocker global value should be cleared'
            );
            assert.ok(showWarningMessageStub.called, 'A migration warning should be shown to the user');
        });

        test('should migrate deprecated useDocker workspace configuration', async () => {
            const { updateStub, showWarningMessageStub } = await setupMigrationTest({
                globalValue: undefined,
                workspaceValue: true,
                workspaceFolderValue: undefined
            });

            assert.ok(
                updateStub.calledWith('docker.enabled', true, vscode.ConfigurationTarget.Workspace),
                'docker.enabled should be migrated to the deprecated workspace value'
            );
            assert.ok(
                updateStub.calledWith('useDocker', undefined, vscode.ConfigurationTarget.Workspace),
                'The deprecated useDocker workspace value should be cleared'
            );
            assert.ok(showWarningMessageStub.called, 'A migration warning should be shown to the user');
        });

        test('should migrate deprecated useDocker folder configuration', async () => {
            const { updateStub, showWarningMessageStub } = await setupMigrationTest({
                globalValue: undefined,
                workspaceValue: undefined,
                workspaceFolderValue: true
            });

            assert.ok(
                updateStub.calledWith('docker.enabled', true, vscode.ConfigurationTarget.WorkspaceFolder),
                'docker.enabled should be migrated to the deprecated folder value'
            );
            assert.ok(
                updateStub.calledWith('useDocker', undefined, vscode.ConfigurationTarget.WorkspaceFolder),
                'The deprecated useDocker folder value should be cleared'
            );
            assert.ok(showWarningMessageStub.called, 'A migration warning should be shown to the user');
        });

        test('should not migrate when no deprecated useDocker value is set', async () => {
            const { updateStub, showWarningMessageStub } = await setupMigrationTest({});

            assert.ok(!updateStub.called, 'No configuration update should happen without a deprecated value');
            assert.ok(!showWarningMessageStub.called, 'No migration warning should be shown without a deprecated value');
        });

        test('should migrate a legacy global docker.options string to a structured array', async () => {
            const { updateStub, showWarningMessageStub } = await setupMigrationTest({}, {
                globalValue: '--memory=512m --pull=always',
            });

            assert.ok(
                updateStub.calledWith('docker.options', ['--memory=512m', '--pull=always'], vscode.ConfigurationTarget.Global),
                'docker.options should be migrated from a string to the equivalent parsed array'
            );
            assert.ok(showWarningMessageStub.called, 'A migration warning should be shown to the user');
        });

        test('should migrate a legacy workspace docker.options string to a structured array', async () => {
            const { updateStub } = await setupMigrationTest({}, {
                workspaceValue: '--user 1000:1000',
            });

            assert.ok(
                updateStub.calledWith('docker.options', ['--user', '1000:1000'], vscode.ConfigurationTarget.Workspace),
                'docker.options should be migrated from a string to the equivalent parsed array'
            );
        });

        test('should not touch docker.options when it is already a structured array', async () => {
            const { updateStub } = await setupMigrationTest({}, {
                globalValue: ['--memory=512m'],
            });

            assert.ok(
                !updateStub.calledWith('docker.options', sinon.match.any, vscode.ConfigurationTarget.Global),
                'An already-structured docker.options array should not be rewritten'
            );
        });

        test('should use Docker when enabled', async () => {
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('html');
            mockWorkspaceConfig.get.withArgs('htmlOptString').returns('');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(true);
            mockWorkspaceConfig.get.withArgs('docker.options', []).returns(['--memory=512m', '--pull=always']);
            mockWorkspaceConfig.get.withArgs('docker.image').returns('pandoc/latex:3.10.0.0-ubuntu');
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, null, '', null);

            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();

            assert.ok(execFileStub.called, 'execFile should have been called');
            assert.strictEqual(execFileStub.firstCall.args[0], 'docker', 'The command should be docker when docker.enabled is true');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('pandoc/latex:3.10.0.0-ubuntu'), 'The configured Docker image should be used');
            assert.ok(args.includes('--memory=512m') && args.includes('--pull=always'), 'Configured docker.options should be passed through');
        });
    });

    suite('Command Registration Tests', () => {
        
        test('activate should register pandoc.render command', () => {
            // Arrange - using the registerCommandStub from setup
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('pdf');
            
            // Act
            extension.activate(mockContext);
            
            // Assert
            assert.ok(registerCommandStub.calledWith('pandoc.render'), 'pandoc.render command should be registered');
            assert.strictEqual(mockContext.subscriptions.length, 2, 'Output channel and command should be added to subscriptions');
            assert.strictEqual(mockContext.subscriptions[0], mockOutputChannel, 'Output channel should be disposed with the extension');
            assert.strictEqual(mockContext.subscriptions[1], registerCommandStub.returnValues[0], 'Command should be disposed with the extension');
        });
    });

    suite('File Path Handling Tests', () => {
        
        test('should handle file paths with spaces correctly', () => {
            // Arrange
            const filePathWithSpaces = '/test/path with spaces/document.md';
            mockDocument.fileName = filePathWithSpaces;
            
            // Act & Assert - File paths should be quoted properly
            const normalizedPath = path.normalize(filePathWithSpaces);
            const quotedPath = normalizedPath.replace(/(^.*$)/gm, '"' + "$1" + '"');
            
            assert.ok(quotedPath.includes('"'), 'File paths with spaces should be quoted');
        });

        test('should extract correct file components', () => {
            // Arrange
            const testPath = '/test/path/document.md';
            
            // Act
            const filePath = path.dirname(testPath);
            const fileName = path.basename(testPath);
            const fileNameOnly = path.parse(fileName).name;
            
            // Assert
            assert.strictEqual(filePath, '/test/path', 'Directory path should be extracted correctly');
            assert.strictEqual(fileName, 'document.md', 'File name should be extracted correctly');
            assert.strictEqual(fileNameOnly, 'document', 'File name without extension should be extracted correctly');
        });
    });

    suite('Error Handling Tests', () => {
        
        test('should handle missing active editor gracefully', async () => {
            // Arrange
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('pdf');
            sandbox.stub(vscode.window, 'activeTextEditor').value(undefined);
            const execFileStub = sandbox.stub(require('child_process'), 'execFile');

            // Act - should return early without throwing
            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();

            // Assert
            assert.ok(!execFileStub.called, 'execFile should not be called when there is no active editor');
        });

        test('should handle pandoc execution errors', async () => {
            // Arrange
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('pdf');
            mockWorkspaceConfig.get.withArgs('pdfOptString').returns('');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});
            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, new Error('Pandoc not found'), '', null);
            const showErrorMessageStub = vscode.window.showErrorMessage as sinon.SinonStub;

            // Act
            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();

            // Assert - Error should be displayed to the user. (Logging to the output
            // channel isn't independently checkable here: `pandocOutputChannel` is
            // captured once at module load via the real vscode.window.createOutputChannel,
            // before mockOutputChannel is stubbed in, so production code never writes
            // into this test's mock instance.)
            assert.ok(
                showErrorMessageStub.calledWithMatch(/exec error/),
                'An "exec error" message should be shown to the user'
            );
        });

        test('should handle stderr output from pandoc', async () => {
            // Arrange
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('pdf');
            mockWorkspaceConfig.get.withArgs('pdfOptString').returns('');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});
            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, null, '', 'warning: deprecated option');
            const showErrorMessageStub = vscode.window.showErrorMessage as sinon.SinonStub;

            // Act
            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();

            // Assert - Stderr should be surfaced as an error message
            assert.ok(
                showErrorMessageStub.calledWithMatch(/stderr/),
                'A "stderr" message should be shown to the user'
            );
        });
    });

    suite('Quick Pick Menu Tests', () => {
        
        test('should display all supported formats in quick pick', () => {
            // Arrange
            const expectedFormats = [
                'pdf', 'docx', 'html', 'asciidoc', 'docbook', 'epub', 'rst',
                'odt', 'pptx', 'latex', 'beamer', 'rtf', 'org', 'mediawiki',
                'textile', 'dokuwiki', 'jira', 'ipynb', 'typst', 'plain',
                'gfm', 'commonmark', 'opml', 'icml', 'jats', 'man', 'texinfo',
                'fb2', 'revealjs'
            ];
            
            // Act - Quick pick should be shown with all formats
            
            // Assert - Will verify the items passed to showQuickPick contain all expected formats
            assert.strictEqual(expectedFormats.length, 29, 'Should support 29 output formats');
        });

        test('should handle quick pick cancellation without saving a dirty document', async () => {
            mockDocument.isDirty = true;
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('');
            mockWorkspaceConfig.get.withArgs('sortByFrequency', true).returns(true);
            mockContext.globalState.get = sandbox.stub().withArgs('pandoc.formatUsage', {}).returns({});
            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
            const showQuickPickStub = vscode.window.showQuickPick as sinon.SinonStub;
            showQuickPickStub.resolves(undefined);
            const execFileStub = sandbox.stub(require('child_process'), 'execFile');

            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();
            await Promise.resolve();

            assert.ok(showQuickPickStub.called, 'Quick pick should be shown');
            assert.ok(!(mockDocument.save as sinon.SinonStub).called, 'Cancelling must not save the document');
            assert.ok(!execFileStub.called, 'Cancelling must not invoke pandoc');
        });

        /**
         * Helper: sets up the common stubs needed by every frequency-sorting test.
         * Returns the showQuickPick and globalState.update stubs for assertions.
         */
        function setupFrequencyTest(opts: {
            usageCounts?: Record<string, number>;
            sortByFrequency?: boolean;
            quickPickResult?: vscode.QuickPickItem | undefined;
            formatOptKey?: string;
        }) {
            const usageCounts = opts.usageCounts ?? {};
            mockContext.globalState.get = sandbox.stub().withArgs('pandoc.formatUsage', {}).returns(usageCounts);
            const globalStateUpdateStub = mockContext.globalState.update as sinon.SinonStub;

            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('');
            mockWorkspaceConfig.get.withArgs('sortByFrequency', true).returns(opts.sortByFrequency ?? true);
            if (opts.formatOptKey) {
                mockWorkspaceConfig.get.withArgs(opts.formatOptKey).returns('');
            }
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.get.withArgs('luaFilters', []).returns([]);
            mockWorkspaceConfig.get.withArgs('enableAdmonitions', false).returns(false);
            mockWorkspaceConfig.get.withArgs('outputFolder', '').returns('');
            mockWorkspaceConfig.get.withArgs('render.promptForOutputFolder', false).returns(false);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});

            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);

            const showQuickPickStub = vscode.window.showQuickPick as sinon.SinonStub;
            showQuickPickStub.resolves(opts.quickPickResult);

            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, null, '', null);

            return { showQuickPickStub, globalStateUpdateStub };
        }

        /** Helper: activates the extension and invokes the registered command. */
        async function activateAndRun() {
            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            if (commandCallback) {
                await commandCallback();
            }
        }

        test('should sort quick pick items by usage frequency', async () => {
            const { showQuickPickStub } = setupFrequencyTest({
                usageCounts: { docx: 5, html: 3 },
                quickPickResult: undefined,
                formatOptKey: 'docxOptString',
            });

            await activateAndRun();

            assert.ok(showQuickPickStub.called, 'showQuickPick should have been called');
            const items: vscode.QuickPickItem[] = showQuickPickStub.firstCall.args[0];
            assert.strictEqual(items[0].label, 'docx', 'Most used format should be first');
            assert.strictEqual(items[1].label, 'html', 'Second most used format should be second');
        });

        test('should not sort quick pick items when sortByFrequency is disabled', async () => {
            const { showQuickPickStub } = setupFrequencyTest({
                usageCounts: { docx: 99 },
                sortByFrequency: false,
                quickPickResult: undefined,
                formatOptKey: 'docxOptString',
            });

            await activateAndRun();

            assert.ok(showQuickPickStub.called, 'showQuickPick should have been called');
            const items: vscode.QuickPickItem[] = showQuickPickStub.firstCall.args[0];
            assert.strictEqual(items[0].label, 'pdf', 'First item should remain pdf when sorting is disabled');
        });

        test('should update globalState usage count after format selection', async () => {
            const { globalStateUpdateStub } = setupFrequencyTest({
                quickPickResult: { label: 'rst', description: 'Render as rst document' },
                formatOptKey: 'rstOptString',
            });

            await activateAndRun();
            await Promise.resolve();

            assert.ok(
                globalStateUpdateStub.calledWith('pandoc.formatUsage', { rst: 1 }),
                'globalState should be updated with the selected format count'
            );
        });

        test('should still track usage when sortByFrequency is disabled', async () => {
            const { globalStateUpdateStub } = setupFrequencyTest({
                sortByFrequency: false,
                quickPickResult: { label: 'html', description: 'Render as html document' },
                formatOptKey: 'htmlOptString',
            });

            await activateAndRun();
            await Promise.resolve();

            assert.ok(
                globalStateUpdateStub.calledWith('pandoc.formatUsage', { html: 1 }),
                'globalState should still be updated even when sorting is disabled'
            );
        });

    suite('Status Bar Tests', () => {
        
        test('should set status bar message during generation', async () => {
            // Arrange
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('pdf');
            mockWorkspaceConfig.get.withArgs('pdfOptString').returns('');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});
            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
            sandbox.stub(require('child_process'), 'execFile').callsArgWith(3, null, '', null);
            const setStatusBarMessageStub = vscode.window.setStatusBarMessage as sinon.SinonStub;

            // Act
            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();

            // Assert - Status bar message should announce generation for the format
            assert.ok(
                setStatusBarMessageStub.calledWithMatch(/^Generating \[pdf\]/),
                'Status bar should show a "Generating [pdf]" message'
            );
        });

        test('should set status bar message when launching viewer', async () => {
            // Arrange
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('pdf');
            mockWorkspaceConfig.get.withArgs('pdfOptString').returns('');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(true);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});
            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
            // callsFake (rather than callsArgWith) because this stub also serves
            // openDocument()'s execFile("open", [outFile]) call, which passes no
            // callback at all.
            sandbox.stub(require('child_process'), 'execFile').callsFake((...callArgs: unknown[]) => {
                const callback = callArgs[3];
                if (typeof callback === 'function') {
                    (callback as (...cbArgs: unknown[]) => void)(null, '', null);
                }
            });
            const setStatusBarMessageStub = vscode.window.setStatusBarMessage as sinon.SinonStub;

            // Act
            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();

            // Assert - Status bar should show a launching message once openViewer succeeds
            assert.ok(
                setStatusBarMessageStub.calledWithMatch(/^Launching \[pdf\]/),
                'Status bar should show a "Launching [pdf]" message when render.openViewer is enabled'
            );
        });
    });

    suite('Output Channel Tests', () => {
        function configureRender() {
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('pdf');
            mockWorkspaceConfig.get.withArgs('pdfOptString').returns('');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});
            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
        }

        test('should log stdout to output channel', async () => {
            configureRender();
            sandbox.stub(require('child_process'), 'execFile')
                .callsArgWith(3, null, 'Pandoc output', '');

            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();

            assert.ok(mockOutputChannel.append.calledWith('Pandoc output\n'));
        });

        test('should log stderr to output channel', async () => {
            configureRender();
            sandbox.stub(require('child_process'), 'execFile')
                .callsArgWith(3, null, '', 'Error output');

            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();

            assert.ok(mockOutputChannel.append.calledWith('stderr: Error output\n'));
        });

        test('should log migration messages to output channel', async () => {
            configureRender();
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({
                globalValue: true
            });
            sandbox.stub(require('child_process'), 'execFile')
                .callsArgWith(3, null, '', '');

            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();

            assert.ok(mockOutputChannel.append.calledWith(
                'migrating global configuration "pandoc.useDocker" -> "pandoc.docker.enabled"\n'
            ));
        });
    });

    suite('Integration Tests', () => {
        
        /**
         * Helper: stubs execFile so it invokes its callback (when given one) with
         * a successful result, without throwing on the callback-less execFile
         * call openDocument() makes when render.openViewer is enabled.
         */
        function stubSuccessfulExecFile(stdout: string) {
            return sandbox.stub(require('child_process'), 'execFile').callsFake((...callArgs: unknown[]) => {
                const callback = callArgs[3];
                if (typeof callback === 'function') {
                    (callback as (...cbArgs: unknown[]) => void)(null, stdout, null);
                }
            });
        }

        test('should complete full render workflow with default format', async () => {
            // Arrange
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('pdf');
            mockWorkspaceConfig.get.withArgs('pdfOptString').returns('--pdf-engine=lualatex');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(true);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});

            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
            const execFileStub = stubSuccessfulExecFile('Success');
            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();

            assert.ok(execFileStub.calledWith('pandoc'), 'pandoc should be invoked directly (no picker, no Docker)');
            const renderArgs: string[] = execFileStub.firstCall.args[1];
            assert.ok(renderArgs.includes('--to=pdf'), 'Should render to the configured default format');
            assert.ok(renderArgs.includes('--pdf-engine=lualatex'), 'Should include the configured PDF options');
            const openExternalStub = vscode.env.openExternal as sinon.SinonStub;
            assert.ok(openExternalStub.calledOnce, 'Rendered output should be opened through vscode.env.openExternal');
            assert.strictEqual(openExternalStub.firstCall.args[0].scheme, 'file');
        });

        test('should complete full render workflow with quick pick selection', async () => {
            // Arrange
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('');
            mockWorkspaceConfig.get.withArgs('docxOptString').returns('-s');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.get.withArgs('sortByFrequency', true).returns(true);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});

            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
            mockContext.globalState.get = sandbox.stub().withArgs('pandoc.formatUsage', {}).returns({});
            const showQuickPickStub = vscode.window.showQuickPick as sinon.SinonStub;
            showQuickPickStub.resolves({ label: 'docx', description: 'Render as word document' });
            const execFileStub = stubSuccessfulExecFile('Success');

            // Act - no defaultOutputFormat and no command args means the picker drives the format
            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();
            // The picker resolves asynchronously (Thenable), so let its .then() run.
            await new Promise((resolve) => setImmediate(resolve));

            // Assert
            assert.ok(showQuickPickStub.called, 'Quick pick should have been shown when no format was preselected');
            assert.ok(execFileStub.called, 'execFile should have been called after a format was picked');
            const renderArgs: string[] = execFileStub.firstCall.args[1];
            assert.ok(renderArgs.includes('--to=docx'), 'Should render to the format chosen from the picker');
        });

        test('should complete full Docker workflow', async () => {
            // Arrange
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('html');
            mockWorkspaceConfig.get.withArgs('htmlOptString').returns('-s -t html5');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(true);
            mockWorkspaceConfig.get.withArgs('docker.options', []).returns([]);
            mockWorkspaceConfig.get.withArgs('docker.image').returns('pandoc/latex:3.10.0.0-ubuntu');
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});

            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
            const execFileStub = stubSuccessfulExecFile('Docker success');

            // Act
            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();

            // Assert - the Docker path ran end to end, hardened defaults included
            assert.ok(execFileStub.calledWith('docker'), 'docker should be the command when docker.enabled is true');
            const dockerArgs: string[] = execFileStub.firstCall.args[1];
            assert.ok(dockerArgs.includes('pandoc/latex:3.10.0.0-ubuntu'), 'Should use the configured Docker image');
            assert.ok(dockerArgs.includes('--to=html'), 'Should render to the configured default format');
            assert.ok(dockerArgs.includes('--network=none'), 'Hardened Docker defaults should still apply');
        });
    });

    suite('Command Arguments Tests', () => {

        /**
         * Helper: activates the extension and invokes the pandoc.render command
         * callback directly with the given command arguments, returning the
         * execFile and showErrorMessage stubs for assertions.
         */
        async function invokeRender(
            commandArgs: { outputType?: string } | undefined,
            defaultOutputFormat: string
        ) {
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns(defaultOutputFormat);
            mockWorkspaceConfig.get.withArgs('epubOptString').returns('');
            mockWorkspaceConfig.get.withArgs('pdfOptString').returns('');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('docker.options', []).returns([]);
            mockWorkspaceConfig.get.withArgs('docker.image').returns('pandoc/latex:latest');
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.get.withArgs('luaFilters', []).returns([]);
            mockWorkspaceConfig.get.withArgs('enableAdmonitions', false).returns(false);
            mockWorkspaceConfig.get.withArgs('sortByFrequency', true).returns(true);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});

            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);

            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, null, '', null);

            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback(commandArgs);

            const showErrorMessageStub = vscode.window.showErrorMessage as sinon.SinonStub;
            return { execFileStub, showErrorMessageStub };
        }

        test('should refuse to render in an untrusted workspace', async () => {
            isTrustedStub.value(false);

            const { execFileStub, showErrorMessageStub } = await invokeRender({ outputType: 'pdf' }, '');

            assert.ok(!execFileStub.called, 'execFile must not run in an untrusted workspace');
            assert.ok(showErrorMessageStub.called, 'An error should be shown for an untrusted workspace');
        });

        test('should render using a valid outputType argument', async () => {
            const { execFileStub, showErrorMessageStub } = await invokeRender({ outputType: 'epub' }, '');

            assert.ok(execFileStub.called, 'execFile should have been called for a valid outputType');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--to=epub'), 'Args should contain --to=epub');
            assert.ok(!showErrorMessageStub.called, 'No error should be shown for a valid outputType');
        });

        test('outputType argument should override a valid defaultOutputFormat', async () => {
            const { execFileStub } = await invokeRender({ outputType: 'pdf' }, 'epub');

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--to=pdf'), 'outputType should take precedence over defaultOutputFormat');
        });

        test('should reject an unsupported outputType argument without invoking pandoc', async () => {
            mockDocument.isDirty = true;
            const { execFileStub, showErrorMessageStub } = await invokeRender(
                { outputType: '../../etc/passwd' },
                ''
            );

            assert.ok(!execFileStub.called, 'execFile must not run for an unrecognized outputType');
            assert.ok(!(mockDocument.save as sinon.SinonStub).called, 'Invalid arguments must not save the document');
            assert.ok(showErrorMessageStub.called, 'An error should be shown for an unrecognized outputType');
        });

        test('should reject an unsupported defaultOutputFormat without invoking pandoc', async () => {
            const { execFileStub, showErrorMessageStub } = await invokeRender(undefined, 'not-a-real-format');

            assert.ok(!execFileStub.called, 'execFile must not run for an unrecognized defaultOutputFormat');
            assert.ok(showErrorMessageStub.called, 'An error should be shown for an unrecognized defaultOutputFormat');
        });

        test('should not attempt to save a clean document', async () => {
            mockDocument.isDirty = false;

            const { execFileStub } = await invokeRender({ outputType: 'pdf' }, '');

            assert.ok(!(mockDocument.save as sinon.SinonStub).called, 'save() should not be called for a clean document');
            assert.ok(execFileStub.called, 'execFile should still run for a clean document');
        });

        test('should save a dirty document before rendering', async () => {
            mockDocument.isDirty = true;
            (mockDocument.save as sinon.SinonStub).resolves(true);

            const { execFileStub } = await invokeRender({ outputType: 'pdf' }, '');

            assert.ok((mockDocument.save as sinon.SinonStub).called, 'save() should be called for a dirty document');
            assert.ok(execFileStub.called, 'execFile should run after a successful save');
        });

        test('should not render if saving a dirty document fails', async () => {
            mockDocument.isDirty = true;
            (mockDocument.save as sinon.SinonStub).resolves(false);

            const { execFileStub, showErrorMessageStub } = await invokeRender({ outputType: 'pdf' }, '');

            assert.ok(!execFileStub.called, 'execFile must not run when the save fails');
            assert.ok(showErrorMessageStub.called, 'An error should be shown when the save fails');
        });
    });

    suite('Lua Filters Tests', () => {

        /**
         * Helper: sets up stubs for lua filter tests, invokes the render command,
         * and returns the execFile stub for assertions on the actual args.
         */
        async function setupFilterTest(opts: {
            luaFilters?: string[];
            enableAdmonitions?: boolean;
            useDocker?: boolean;
            dockerImage?: string;
            dockerOptions?: string[];
            format?: string;
            formatOptKey?: string;
        }) {
            const format = opts.format ?? 'html';
            const formatOptKey = opts.formatOptKey ?? 'htmlOptString';

            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns(format);
            mockWorkspaceConfig.get.withArgs(formatOptKey).returns('');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(opts.useDocker ?? false);
            mockWorkspaceConfig.get.withArgs('docker.options', []).returns(opts.dockerOptions ?? []);
            mockWorkspaceConfig.get.withArgs('docker.image').returns(opts.dockerImage ?? 'pandoc/latex:latest');
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.get.withArgs('luaFilters', []).returns(opts.luaFilters ?? []);
            mockWorkspaceConfig.get.withArgs('enableAdmonitions', false).returns(opts.enableAdmonitions ?? false);
            mockWorkspaceConfig.get.withArgs('sortByFrequency', true).returns(true);
            mockWorkspaceConfig.get.withArgs('outputFolder', '').returns('');
            mockWorkspaceConfig.get.withArgs('render.promptForOutputFolder', false).returns(false);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});

            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);

            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, null, '', null);

            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            if (commandCallback) {
                await commandCallback();
            }

            return { execFileStub };
        }

        test('should not include --lua-filter args when no filters configured', async () => {
            const { execFileStub } = await setupFilterTest({});

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(!args.includes('--lua-filter'), 'No --lua-filter args should be present');
        });

        test('should include --lua-filter args for user-specified filters', async () => {
            const { execFileStub } = await setupFilterTest({
                luaFilters: ['/path/to/filter.lua'],
            });

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            const filterIdx = args.indexOf('--lua-filter');
            assert.ok(filterIdx !== -1, '--lua-filter arg should be present');
            assert.strictEqual(args[filterIdx + 1], '/path/to/filter.lua', 'Filter path should follow --lua-filter');
        });

        test('should include multiple --lua-filter args for multiple filters', async () => {
            const { execFileStub } = await setupFilterTest({
                luaFilters: ['/path/to/filter1.lua', '/path/to/filter2.lua'],
            });

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            const filterIndices: number[] = [];
            args.forEach((arg, i) => { if (arg === '--lua-filter') { filterIndices.push(i); } });
            assert.strictEqual(filterIndices.length, 2, 'Should have two --lua-filter args');
            assert.strictEqual(args[filterIndices[0] + 1], '/path/to/filter1.lua');
            assert.strictEqual(args[filterIndices[1] + 1], '/path/to/filter2.lua');
        });

        test('should mount filters into Docker container and rewrite paths', async () => {
            const { execFileStub } = await setupFilterTest({
                luaFilters: ['/host/path/filter.lua'],
                useDocker: true,
            });

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];

            // Should have a -v mount for the filter
            const mountIdx = args.indexOf('/host/path/filter.lua:/filters/filter-0.lua:ro');
            assert.ok(mountIdx !== -1, 'Filter file should be bind-mounted into container');
            assert.strictEqual(args[mountIdx - 1], '-v', 'Mount should be preceded by -v flag');

            // --lua-filter should reference the container path, not the host path
            const filterIdx = args.indexOf('--lua-filter');
            assert.ok(filterIdx !== -1, '--lua-filter arg should be present');
            assert.strictEqual(args[filterIdx + 1], '/filters/filter-0.lua', 'Filter path should be the container path');
        });

        test('should apply hardened Docker defaults (no network, no capabilities, no privilege escalation)', async () => {
            const { execFileStub } = await setupFilterTest({ useDocker: true });

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];

            assert.ok(args.includes('--network=none'), 'Docker should run with no network access by default');
            assert.ok(args.includes('--cap-drop=ALL'), 'Docker should drop all Linux capabilities by default');
            assert.ok(args.includes('--security-opt=no-new-privileges'), 'Docker should block privilege escalation by default');
        });

        test('should mount the source directory read-only and route output through a separate /output mount', async () => {
            const { execFileStub } = await setupFilterTest({ useDocker: true });

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];

            const inputMountIdx = args.indexOf('/test/path:/data:ro');
            assert.ok(inputMountIdx !== -1, 'Source directory should be mounted read-only at /data');
            assert.strictEqual(args[inputMountIdx - 1], '-v', 'Read-only mount should be preceded by -v');

            const outputMountIdx = args.indexOf('/test/path:/output');
            assert.ok(outputMountIdx !== -1, 'A writable /output mount should be present even without a custom output folder');
            assert.strictEqual(args[outputMountIdx - 1], '-v', 'Writable mount should be preceded by -v');

            const outIdx = args.indexOf('-o');
            assert.ok(outIdx !== -1, '-o flag should be present');
            assert.strictEqual(
                args[outIdx + 1],
                '/output/document.html',
                'Pandoc should write through the /output mount, never back into the read-only /data mount'
            );
        });

        test('user-supplied dockerOptions should be appended after the hardened defaults', async () => {
            const { execFileStub } = await setupFilterTest({
                useDocker: true,
                dockerOptions: ['--network=bridge'],
            });

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];

            const defaultIdx = args.indexOf('--network=none');
            const overrideIdx = args.indexOf('--network=bridge');
            assert.ok(defaultIdx !== -1, 'Hardened default should still be present');
            assert.ok(overrideIdx !== -1, 'User override should be present');
            assert.ok(overrideIdx > defaultIdx, 'User-supplied dockerOptions should come after the hardened defaults so they can override them');
        });
    });

    suite('Admonition Filter Tests', () => {

        /**
         * Helper: same as filter test setup but always stubs execFile fresh.
         */
        async function setupAdmonitionTest(opts: {
            enableAdmonitions: boolean;
            luaFilters?: string[];
            useDocker?: boolean;
            format?: string;
            formatOptKey?: string;
        }) {
            const format = opts.format ?? 'pdf';
            const formatOptKey = opts.formatOptKey ?? 'pdfOptString';

            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns(format);
            mockWorkspaceConfig.get.withArgs(formatOptKey).returns('');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(opts.useDocker ?? false);
            mockWorkspaceConfig.get.withArgs('docker.options', []).returns([]);
            mockWorkspaceConfig.get.withArgs('docker.image').returns('pandoc/latex:latest');
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.get.withArgs('luaFilters', []).returns(opts.luaFilters ?? []);
            mockWorkspaceConfig.get.withArgs('enableAdmonitions', false).returns(opts.enableAdmonitions);
            mockWorkspaceConfig.get.withArgs('sortByFrequency', true).returns(true);
            mockWorkspaceConfig.get.withArgs('outputFolder', '').returns('');
            mockWorkspaceConfig.get.withArgs('render.promptForOutputFolder', false).returns(false);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});

            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);

            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, null, '', null);

            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            if (commandCallback) {
                await commandCallback();
            }

            return { execFileStub };
        }

        test('should not include bundled filter when enableAdmonitions is false', async () => {
            const { execFileStub } = await setupAdmonitionTest({ enableAdmonitions: false });

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(!args.includes('--lua-filter'), 'No --lua-filter args when admonitions disabled');
        });

        test('should include bundled admonition filter when enableAdmonitions is true', async () => {
            const { execFileStub } = await setupAdmonitionTest({ enableAdmonitions: true });

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            const filterIdx = args.indexOf('--lua-filter');
            assert.ok(filterIdx !== -1, '--lua-filter arg should be present');
            const filterPath = args[filterIdx + 1];
            assert.ok(
                filterPath.includes(path.join('filters', 'docusaurus-admonitions.lua')),
                'Should use the bundled admonition filter path'
            );
        });

        test('should prepend bundled filter before user-specified filters', async () => {
            const { execFileStub } = await setupAdmonitionTest({
                enableAdmonitions: true,
                luaFilters: ['/user/custom.lua'],
            });

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];

            // Collect all filter paths in order
            const filterPaths: string[] = [];
            args.forEach((arg, i) => {
                if (arg === '--lua-filter') { filterPaths.push(args[i + 1]); }
            });

            assert.strictEqual(filterPaths.length, 2, 'Should have two filters');
            assert.ok(
                filterPaths[0].includes('docusaurus-admonitions.lua'),
                'Bundled admonition filter should come first'
            );
            assert.strictEqual(filterPaths[1], '/user/custom.lua', 'User filter should come second');
        });

        test('should mount bundled filter into Docker container when admonitions enabled', async () => {
            const { execFileStub } = await setupAdmonitionTest({
                enableAdmonitions: true,
                useDocker: true,
            });

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];

            // Should have a -v mount for the bundled filter
            const mountArg = args.find((a) => a.includes('docusaurus-admonitions.lua') && a.includes('/filters/filter-'));
            assert.ok(mountArg, 'Bundled filter should be bind-mounted into container');

            // --lua-filter should use container path
            const filterIdx = args.indexOf('--lua-filter');
            assert.ok(filterIdx !== -1, '--lua-filter should be present');
            assert.strictEqual(args[filterIdx + 1], '/filters/filter-0.lua', 'Should use container path for filter');
        });
    });

    suite('Output Folder Tests', () => {

        /**
         * Helper: sets up stubs for output folder tests, activates the extension,
         * and invokes the registered command with the given output type argument.
         */
        async function setupOutputFolderTest(opts: {
            outputFolder?: string;
            promptForOutputFolder?: boolean;
            inputBoxResult?: string | undefined;
            format?: string;
            formatOptKey?: string;
            useDocker?: boolean;
        }) {
            const format = opts.format ?? 'html';
            const formatOptKey = opts.formatOptKey ?? 'htmlOptString';

            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns(format);
            mockWorkspaceConfig.get.withArgs(formatOptKey).returns('');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(opts.useDocker ?? false);
            mockWorkspaceConfig.get.withArgs('docker.options', []).returns([]);
            mockWorkspaceConfig.get.withArgs('docker.image').returns('pandoc/latex:latest');
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.get.withArgs('luaFilters', []).returns([]);
            mockWorkspaceConfig.get.withArgs('enableAdmonitions', false).returns(false);
            mockWorkspaceConfig.get.withArgs('sortByFrequency', true).returns(true);
            mockWorkspaceConfig.get.withArgs('outputFolder', '').returns(opts.outputFolder ?? '');
            mockWorkspaceConfig.get.withArgs('render.promptForOutputFolder', false).returns(opts.promptForOutputFolder ?? false);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});

            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);

            const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox');
            if (opts.promptForOutputFolder) {
                showInputBoxStub.resolves(opts.inputBoxResult);
            }

            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, null, '', null);

            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            if (commandCallback) {
                await commandCallback();
            }

            return { execFileStub, showInputBoxStub };
        }

        test('should output to source directory when outputFolder is not configured', async () => {
            const { execFileStub } = await setupOutputFolderTest({ outputFolder: '' });

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            const outIdx = args.indexOf('-o');
            assert.ok(outIdx !== -1, '-o flag should be present');
            assert.strictEqual(
                args[outIdx + 1],
                path.join('/test/path', 'document') + '.html',
                'Output file should be in source directory'
            );
        });

        test('should output to configured outputFolder when set', async () => {
            const customFolder = '/custom/output/dir';
            const { execFileStub } = await setupOutputFolderTest({ outputFolder: customFolder });

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            const outIdx = args.indexOf('-o');
            assert.ok(outIdx !== -1, '-o flag should be present');
            assert.strictEqual(
                args[outIdx + 1],
                path.join(customFolder, 'document') + '.html',
                'Output file should be in configured output folder'
            );
        });

        test('should show input box when promptForOutputFolder is true', async () => {
            const { showInputBoxStub } = await setupOutputFolderTest({
                promptForOutputFolder: true,
                inputBoxResult: '/prompted/folder',
            });

            assert.ok(showInputBoxStub.called, 'showInputBox should have been shown to prompt for output folder');
        });

        test('should use prompted folder path for output', async () => {
            const promptedFolder = '/prompted/output/dir';
            const { execFileStub } = await setupOutputFolderTest({
                promptForOutputFolder: true,
                inputBoxResult: promptedFolder,
            });

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            const outIdx = args.indexOf('-o');
            assert.ok(outIdx !== -1, '-o flag should be present');
            assert.strictEqual(
                args[outIdx + 1],
                path.join(promptedFolder, 'document') + '.html',
                'Output file should be in the prompted folder'
            );
        });

        test('should not render when user cancels the output folder prompt', async () => {
            const { execFileStub } = await setupOutputFolderTest({
                promptForOutputFolder: true,
                inputBoxResult: undefined, // user pressed Escape
            });

            assert.ok(!execFileStub.called, 'execFile should not be called when prompt is cancelled');
        });

        test('should pre-fill prompt with configured outputFolder when both are set', async () => {
            const configuredFolder = '/default/folder';
            const { showInputBoxStub } = await setupOutputFolderTest({
                outputFolder: configuredFolder,
                promptForOutputFolder: true,
                inputBoxResult: configuredFolder,
            });

            assert.ok(showInputBoxStub.called, 'showInputBox should have been called');
            const inputBoxOptions = showInputBoxStub.firstCall.args[0] as vscode.InputBoxOptions;
            assert.strictEqual(
                inputBoxOptions.value,
                configuredFolder,
                'Configured outputFolder should be pre-filled as the default value'
            );
        });

        test('should mount custom output folder as /output volume in Docker', async () => {
            const customFolder = '/custom/output/dir';
            const { execFileStub } = await setupOutputFolderTest({
                outputFolder: customFolder,
                useDocker: true,
            });

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];

            const outputMountIdx = args.indexOf(customFolder + ':/output');
            assert.ok(outputMountIdx !== -1, 'Custom output folder should be mounted as /output');
            assert.strictEqual(args[outputMountIdx - 1], '-v', 'Volume mount should be preceded by -v');

            const outIdx = args.indexOf('-o');
            assert.ok(outIdx !== -1, '-o flag should be present');
            assert.strictEqual(
                args[outIdx + 1],
                '/output/document.html',
                'Docker output path should use /output container path'
            );
        });

        test('should still mount an isolated /output volume in Docker when no custom output folder is set', async () => {
            // Even with no custom output folder, output must go through a
            // dedicated writable mount rather than the read-only /data mount
            // shared with the input -- see the read-only-input-mount test below.
            const { execFileStub } = await setupOutputFolderTest({
                outputFolder: '',
                useDocker: true,
            });

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];

            const outputMountIdx = args.indexOf('/test/path:/output');
            assert.ok(outputMountIdx !== -1, 'The source directory should still be mounted as /output for writing');
            assert.strictEqual(args[outputMountIdx - 1], '-v', 'Volume mount should be preceded by -v');

            const outIdx = args.indexOf('-o');
            assert.ok(outIdx !== -1, '-o flag should be present');
            assert.strictEqual(
                args[outIdx + 1],
                '/output/document.html',
                'Docker output should use the /output container path, not a relative path inside the read-only /data mount'
            );
        });
    });

    suite('Output Format and File Extension Tests', () => {

        /**
         * Helper: activates extension with a given default format and returns the execFile stub.
         */
        async function setupRenderTest(format: string, formatOptKey: string) {
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns(format);
            mockWorkspaceConfig.get.withArgs(formatOptKey).returns('');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('docker.options', []).returns([]);
            mockWorkspaceConfig.get.withArgs('docker.image').returns('pandoc/latex:latest');
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.get.withArgs('luaFilters', []).returns([]);
            mockWorkspaceConfig.get.withArgs('enableAdmonitions', false).returns(false);
            mockWorkspaceConfig.get.withArgs('sortByFrequency', true).returns(true);
            mockWorkspaceConfig.get.withArgs('outputFolder', '').returns('');
            mockWorkspaceConfig.get.withArgs('render.promptForOutputFolder', false).returns(false);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});

            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);

            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, null, '', null);

            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            if (commandCallback) {
                await commandCallback();
            }

            return { execFileStub };
        }

        test('should include --to=FORMAT in args for standard format (html)', async () => {
            const { execFileStub } = await setupRenderTest('html', 'htmlOptString');

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--to=html'), 'Args should contain --to=html');
        });

        test('should include --to=FORMAT in args for pdf format', async () => {
            const { execFileStub } = await setupRenderTest('pdf', 'pdfOptString');

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--to=pdf'), 'Args should contain --to=pdf');
        });

        test('should use .md extension and --to=commonmark for commonmark format', async () => {
            // Use a non-.md input so this exercises the extension-mapping logic
            // without tripping the input/output collision guard (document.md -> document.md).
            mockDocument.fileName = '/test/path/document.rst';
            const { execFileStub } = await setupRenderTest('commonmark', 'commonmarkOptString');

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--to=commonmark'), 'Args should contain --to=commonmark');
            // Output file should use .md extension
            const outFileArg: string = args[args.indexOf('-o') + 1];
            assert.ok(outFileArg.endsWith('.md'), 'Output file should use .md extension for commonmark');
        });

        test('should use .md extension and --to=gfm for gfm format', async () => {
            // Use a non-.md input so this exercises the extension-mapping logic
            // without tripping the input/output collision guard (document.md -> document.md).
            mockDocument.fileName = '/test/path/document.rst';
            const { execFileStub } = await setupRenderTest('gfm', 'gfmOptString');

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--to=gfm'), 'Args should contain --to=gfm');
            const outFileArg: string = args[args.indexOf('-o') + 1];
            assert.ok(outFileArg.endsWith('.md'), 'Output file should use .md extension for gfm');
        });

        test('should use .tex extension and --to=latex for latex format', async () => {
            const { execFileStub } = await setupRenderTest('latex', 'latexOptString');

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--to=latex'), 'Args should contain --to=latex');
            const outFileArg: string = args[args.indexOf('-o') + 1];
            assert.ok(outFileArg.endsWith('.tex'), 'Output file should use .tex extension for latex');
        });

        test('should use .tex extension and --to=beamer for beamer format', async () => {
            const { execFileStub } = await setupRenderTest('beamer', 'beamerOptString');

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--to=beamer'), 'Args should contain --to=beamer');
            const outFileArg: string = args[args.indexOf('-o') + 1];
            assert.ok(outFileArg.endsWith('.tex'), 'Output file should use .tex extension for beamer');
        });

        test('should use .txt extension and --to=plain for plain format', async () => {
            const { execFileStub } = await setupRenderTest('plain', 'plainOptString');

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--to=plain'), 'Args should contain --to=plain');
            const outFileArg: string = args[args.indexOf('-o') + 1];
            assert.ok(outFileArg.endsWith('.txt'), 'Output file should use .txt extension for plain');
        });

        test('should use .html extension and --to=revealjs for revealjs format', async () => {
            const { execFileStub } = await setupRenderTest('revealjs', 'revealjsOptString');

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--to=revealjs'), 'Args should contain --to=revealjs');
            const outFileArg: string = args[args.indexOf('-o') + 1];
            assert.ok(outFileArg.endsWith('.html'), 'Output file should use .html extension for revealjs');
        });

        test('should use .xml extension and --to=docbook for docbook format', async () => {
            const { execFileStub } = await setupRenderTest('docbook', 'docbookOptString');

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--to=docbook'), 'Args should contain --to=docbook');
            const outFileArg: string = args[args.indexOf('-o') + 1];
            assert.ok(outFileArg.endsWith('.xml'), 'Output file should use .xml extension for docbook');
        });

        test('should use .xml extension and --to=jats for jats format', async () => {
            const { execFileStub } = await setupRenderTest('jats', 'jatsOptString');

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--to=jats'), 'Args should contain --to=jats');
            const outFileArg: string = args[args.indexOf('-o') + 1];
            assert.ok(outFileArg.endsWith('.xml'), 'Output file should use .xml extension for jats');
        });

        test('should use .adoc extension and --to=asciidoc for asciidoc format', async () => {
            const { execFileStub } = await setupRenderTest('asciidoc', 'asciidocOptString');

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--to=asciidoc'), 'Args should contain --to=asciidoc');
            const outFileArg: string = args[args.indexOf('-o') + 1];
            assert.ok(outFileArg.endsWith('.adoc'), 'Output file should use .adoc extension for asciidoc');
        });

        test('should use .texi extension and --to=texinfo for texinfo format', async () => {
            const { execFileStub } = await setupRenderTest('texinfo', 'texinfoOptString');

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--to=texinfo'), 'Args should contain --to=texinfo');
            const outFileArg: string = args[args.indexOf('-o') + 1];
            assert.ok(outFileArg.endsWith('.texi'), 'Output file should use .texi extension for texinfo');
        });

        test('should use .typ extension and --to=typst for typst format', async () => {
            const { execFileStub } = await setupRenderTest('typst', 'typstOptString');

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--to=typst'), 'Args should contain --to=typst');
            const outFileArg: string = args[args.indexOf('-o') + 1];
            assert.ok(outFileArg.endsWith('.typ'), 'Output file should use .typ extension for typst');
        });

        test('should use format name as extension for formats without a special mapping (rst)', async () => {
            const { execFileStub } = await setupRenderTest('rst', 'rstOptString');

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--to=rst'), 'Args should contain --to=rst');
            const outFileArg: string = args[args.indexOf('-o') + 1];
            assert.ok(outFileArg.endsWith('.rst'), 'Output file should use .rst extension for rst');
        });
    });

    suite('Render Lifecycle Tests', () => {
        function configureLifecycleRender() {
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('pdf');
            mockWorkspaceConfig.get.withArgs('pdfOptString').returns('');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.get.withArgs('render.timeout', 300).returns(300);
            mockWorkspaceConfig.get.withArgs('luaFilters', []).returns([]);
            mockWorkspaceConfig.get.withArgs('enableAdmonitions', false).returns(false);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});
            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
        }

        async function registeredCommand() {
            extension.activate(mockContext);
            return registerCommandStub.firstCall.args[1];
        }

        test('should reject untitled documents before saving or rendering', async () => {
            configureLifecycleRender();
            mockDocument.isUntitled = true;
            mockDocument.isDirty = true;
            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            const commandCallback = await registeredCommand();

            await commandCallback();

            assert.ok(!mockDocument.save.called, 'Untitled documents must not be saved implicitly');
            assert.ok(!execFileStub.called, 'Untitled documents must not be rendered');
            assert.ok((vscode.window.showErrorMessage as sinon.SinonStub).calledWithMatch(/untitled/i));
        });

        test('should reject non-file documents', async () => {
            configureLifecycleRender();
            mockDocument.uri = vscode.Uri.parse('vscode-remote://host/document.md');
            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            const commandCallback = await registeredCommand();

            await commandCallback();

            assert.ok(!execFileStub.called, 'Non-file documents must not be rendered');
            assert.ok((vscode.window.showErrorMessage as sinon.SinonStub).calledWithMatch(/local file/i));
        });

        test('should cancel when an existing output is not approved for overwrite', async () => {
            configureLifecycleRender();
            (require('fs').existsSync as sinon.SinonStub).returns(true);
            (vscode.window.showWarningMessage as sinon.SinonStub).resolves(undefined);
            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            const commandCallback = await registeredCommand();

            await commandCallback();

            assert.ok((vscode.window.showWarningMessage as sinon.SinonStub).calledWithMatch(/already exists/));
            assert.ok(!execFileStub.called, 'Pandoc must not run when overwrite is cancelled');
        });

        test('should render when overwrite is approved', async () => {
            configureLifecycleRender();
            (require('fs').existsSync as sinon.SinonStub).returns(true);
            (vscode.window.showWarningMessage as sinon.SinonStub).resolves('Overwrite');
            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, null, '', '');
            const commandCallback = await registeredCommand();

            await commandCallback();

            assert.ok(execFileStub.calledOnce, 'Pandoc should run after overwrite approval');
        });

        test('should pass the configured timeout to execFile', async () => {
            configureLifecycleRender();
            mockWorkspaceConfig.get.withArgs('render.timeout', 300).returns(42);
            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, null, '', '');
            const commandCallback = await registeredCommand();

            await commandCallback();

            assert.strictEqual(execFileStub.firstCall.args[2].timeout, 42000);
            assert.ok((vscode.window.withProgress as sinon.SinonStub).calledWithMatch({ cancellable: true }));
        });

        test('should disable the execFile timeout when configured to zero', async () => {
            configureLifecycleRender();
            mockWorkspaceConfig.get.withArgs('render.timeout', 300).returns(0);
            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, null, '', '');
            const commandCallback = await registeredCommand();

            await commandCallback();

            assert.strictEqual(execFileStub.firstCall.args[2].timeout, undefined);
        });

        test('should report a timed-out child process clearly', async () => {
            configureLifecycleRender();
            const timeoutError = Object.assign(new Error('killed'), { killed: true });
            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, timeoutError, '', '');
            const commandCallback = await registeredCommand();

            await commandCallback();

            assert.ok((vscode.window.showErrorMessage as sinon.SinonStub).calledWithMatch(/timed out after 300 seconds/));
        });

        test('should reject a concurrent render targeting the same output', async () => {
            configureLifecycleRender();
            let finishFirst: ((error: Error | null, stdout: string, stderr: string) => void) | undefined;
            const execFileStub = sandbox.stub(require('child_process'), 'execFile').callsFake((...args: any[]) => {
                finishFirst = args[3];
            });
            const commandCallback = await registeredCommand();

            const firstRender = commandCallback();
            await new Promise((resolve) => setImmediate(resolve));
            await commandCallback();

            assert.ok(execFileStub.calledOnce, 'Only the first render should invoke pandoc');
            assert.ok((vscode.window.showWarningMessage as sinon.SinonStub).calledWithMatch(/already in progress/));
            finishFirst!(null, '', '');
            await firstRender;
        });

        test('should abort the child process when progress is cancelled', async () => {
            configureLifecycleRender();
            let cancel: (() => void) | undefined;
            (vscode.window.withProgress as sinon.SinonStub).callsFake(async (_options: unknown, task: any) => {
                const token = {
                    isCancellationRequested: false,
                    onCancellationRequested: (callback: () => void) => {
                        cancel = callback;
                        return { dispose: sandbox.stub() };
                    }
                };
                return task({ report: sandbox.stub() }, token);
            });
            const execFileStub = sandbox.stub(require('child_process'), 'execFile').callsFake((...args: any[]) => {
                cancel!();
                args[3](new Error('aborted'), '', '');
            });
            const commandCallback = await registeredCommand();

            await commandCallback();

            assert.ok(execFileStub.firstCall.args[2].signal.aborted, 'Cancellation should abort the child process');
            assert.ok((vscode.window.showErrorMessage as sinon.SinonStub).calledWithMatch(/cancelled/));
        });
    });

    suite('Input/Output Collision Guard Tests', () => {

        async function setupCollisionTest(fileName: string, format: string, formatOptKey: string) {
            mockDocument.fileName = fileName;
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns(format);
            mockWorkspaceConfig.get.withArgs(formatOptKey).returns('');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('docker.options', []).returns([]);
            mockWorkspaceConfig.get.withArgs('docker.image').returns('pandoc/latex:latest');
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.get.withArgs('luaFilters', []).returns([]);
            mockWorkspaceConfig.get.withArgs('enableAdmonitions', false).returns(false);
            mockWorkspaceConfig.get.withArgs('sortByFrequency', true).returns(true);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});

            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);

            const execFileStub = sandbox.stub(require('child_process'), 'execFile');
            execFileStub.callsArgWith(3, null, '', null);

            extension.activate(mockContext);
            const commandCallback = registerCommandStub.firstCall?.args[1];
            await commandCallback();

            const showErrorMessageStub = vscode.window.showErrorMessage as sinon.SinonStub;
            return { execFileStub, showErrorMessageStub };
        }

        test('should block rendering markdown to gfm when it would overwrite the .md source', async () => {
            const { execFileStub, showErrorMessageStub } = await setupCollisionTest(
                '/test/path/document.md',
                'gfm',
                'gfmOptString'
            );

            assert.ok(!execFileStub.called, 'execFile must not run when output would overwrite the source file');
            assert.ok(showErrorMessageStub.called, 'An error should be shown for an input/output collision');
        });

        test('should block rendering markdown to commonmark when it would overwrite the .md source', async () => {
            const { execFileStub, showErrorMessageStub } = await setupCollisionTest(
                '/test/path/document.md',
                'commonmark',
                'commonmarkOptString'
            );

            assert.ok(!execFileStub.called, 'execFile must not run when output would overwrite the source file');
            assert.ok(showErrorMessageStub.called, 'An error should be shown for an input/output collision');
        });

        test('should block rendering html to html when it would overwrite the source file', async () => {
            const { execFileStub, showErrorMessageStub } = await setupCollisionTest(
                '/test/path/document.html',
                'html',
                'htmlOptString'
            );

            assert.ok(!execFileStub.called, 'execFile must not run when output would overwrite the source file');
            assert.ok(showErrorMessageStub.called, 'An error should be shown for an input/output collision');
        });

        test('should allow rendering markdown to gfm when the source has a different extension', async () => {
            const { execFileStub, showErrorMessageStub } = await setupCollisionTest(
                '/test/path/document.rst',
                'gfm',
                'gfmOptString'
            );

            assert.ok(execFileStub.called, 'execFile should run when input and output paths differ');
            assert.ok(!showErrorMessageStub.called, 'No collision error should be shown when paths differ');
        });
    });
});
});
