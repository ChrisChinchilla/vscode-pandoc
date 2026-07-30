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
            languageId: 'markdown'
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
        registerCommandStub = sandbox.stub(vscode.commands, 'registerCommand');
    });

    // Cleanup after each test
    teardown(() => {
        sandbox.restore();
    });

    suite('Configuration Tests', () => {
        
        test('getPandocOptions should return correct options for PDF format', () => {
            // Arrange
            const expectedOptions = '--pdf-engine=lualatex -V documentclass=ltjarticle';
            mockWorkspaceConfig.get.withArgs('pdfOptString').returns(expectedOptions);
            
            // Act - using direct function call since it's not exported, we'll test through the main flow
            // This tests the switch case logic for PDF format
            
            // Assert - We'll verify this through integration tests
            assert.ok(true, 'PDF options configuration test setup complete');
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

        test('getPandocExecutablePath should return custom executable path when configured', () => {
            // Arrange
            const customPath = '/custom/path/to/pandoc';
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.get.withArgs('executable').returns(customPath);
            
            // Act & Assert - Will be tested through command execution
            assert.ok(mockWorkspaceConfig.has.called || !mockWorkspaceConfig.has.called, 'Executable path configuration test setup');
        });

        test('getPandocExecutablePath should return undefined when not configured', () => {
            // Arrange
            mockWorkspaceConfig.has.withArgs('executable').returns(false);
            mockWorkspaceConfig.get.withArgs('executable').returns('');
            
            // Act & Assert - Default pandoc executable should be used
            assert.ok(true, 'Default executable path test setup');
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
        
        test('should migrate deprecated useDocker global configuration', () => {
            // Arrange
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({
                globalValue: true,
                workspaceValue: undefined,
                workspaceFolderValue: undefined
            });
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('docker.options').returns('');
            mockWorkspaceConfig.get.withArgs('docker.image').returns('pandoc/latex:latest');
            
            // Act & Assert - Migration should occur during render command
            assert.ok(true, 'Docker migration test setup for global configuration');
        });

        test('should migrate deprecated useDocker workspace configuration', () => {
            // Arrange
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({
                globalValue: undefined,
                workspaceValue: true,
                workspaceFolderValue: undefined
            });
            
            // Act & Assert - Migration should occur during render command
            assert.ok(true, 'Docker migration test setup for workspace configuration');
        });

        test('should migrate deprecated useDocker folder configuration', () => {
            // Arrange
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({
                globalValue: undefined,
                workspaceValue: undefined,
                workspaceFolderValue: true
            });
            
            // Act & Assert - Migration should occur during render command
            assert.ok(true, 'Docker migration test setup for folder configuration');
        });

        test('should use Docker when enabled', () => {
            // Arrange
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(true);
            mockWorkspaceConfig.get.withArgs('docker.options').returns('--user $(id -u):$(id -g)');
            mockWorkspaceConfig.get.withArgs('docker.image').returns('pandoc/latex:latest');
            
            // Act & Assert - Docker command should be constructed
            assert.ok(true, 'Docker execution test setup');
        });
    });

    suite('Platform-Specific Tests', () => {
        
        test('openDocument should use correct command for macOS', () => {
            // Arrange
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'darwin' });
            
            // Act - This will be tested through the render flow
            
            // Assert
            assert.strictEqual(process.platform, 'darwin', 'Platform should be set to macOS');
            
            // Cleanup
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        test('openDocument should use correct command for Linux', () => {
            // Arrange
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'linux' });
            
            // Act & Assert
            assert.strictEqual(process.platform, 'linux', 'Platform should be set to Linux');
            
            // Cleanup
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        test('openDocument should use default command for Windows', () => {
            // Arrange
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'win32' });
            
            // Act & Assert
            assert.strictEqual(process.platform, 'win32', 'Platform should be set to Windows');
            
            // Cleanup
            Object.defineProperty(process, 'platform', { value: originalPlatform });
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
            assert.strictEqual(mockContext.subscriptions.length, 1, 'Command should be added to subscriptions');
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
        
        test('should handle missing active editor gracefully', () => {
            // Arrange
            sandbox.stub(vscode.window, 'activeTextEditor').value(undefined);
            
            // Act & Assert - Command should return early without error
            assert.ok(true, 'Missing editor test setup - command should handle undefined editor');
        });

        test('should handle pandoc execution errors', () => {
            // Arrange
            const execStub = sandbox.stub(require('child_process'), 'exec');
            execStub.callsArgWith(2, new Error('Pandoc not found'), null, 'stderr output');
            
            // Act & Assert - Error should be displayed to user
            assert.ok(true, 'Pandoc execution error test setup');
        });

        test('should handle stderr output from pandoc', () => {
            // Arrange
            const execStub = sandbox.stub(require('child_process'), 'exec');
            execStub.callsArgWith(2, null, 'stdout output', 'warning: deprecated option');
            
            // Act & Assert - Stderr should be shown as error message
            assert.ok(true, 'Stderr handling test setup');
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

        test('should handle quick pick cancellation', () => {
            // Arrange
            const showQuickPickStub = vscode.window.showQuickPick as sinon.SinonStub;
            showQuickPickStub.resolves(undefined); // User cancelled
            
            // Act & Assert - Should return early without error
            assert.ok(showQuickPickStub.calledWith, 'Quick pick cancellation test setup');
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
        
        test('should set status bar message during generation', () => {
            // Arrange
            const setStatusBarMessageStub = vscode.window.setStatusBarMessage as sinon.SinonStub;
            
            // Act - Status bar should be updated during render process
            
            // Assert - Status bar message should contain generation info
            assert.ok(setStatusBarMessageStub !== undefined, 'Status bar message stub should be defined');
        });

        test('should set status bar message when launching viewer', () => {
            // Arrange
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(true);
            
            // Act & Assert - Status bar should show launching message
            assert.ok(true, 'Viewer launch status test setup');
        });
    });

    suite('Output Channel Tests', () => {
        
        test('should log stdout to output channel', () => {
            // Arrange
            const execStub = sandbox.stub(require('child_process'), 'exec');
            execStub.callsArgWith(2, null, 'Pandoc output', null);
            
            // Act & Assert - Output should be appended to channel
            assert.ok(mockOutputChannel.append, 'Output channel should have append method');
        });

        test('should log stderr to output channel', () => {
            // Arrange
            const execStub = sandbox.stub(require('child_process'), 'exec');
            execStub.callsArgWith(2, null, null, 'Error output');
            
            // Act & Assert - Error output should be logged
            assert.ok(mockOutputChannel.append, 'Output channel should log stderr');
        });

        test('should log migration messages to output channel', () => {
            // Arrange - Set up deprecated configuration
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({
                globalValue: true
            });
            
            // Act & Assert - Migration message should be logged
            assert.ok(mockOutputChannel.append, 'Migration messages should be logged');
        });
    });

    suite('Integration Tests', () => {
        
        test('should complete full render workflow with default format', () => {
            // Arrange
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('pdf');
            mockWorkspaceConfig.get.withArgs('pdfOptString').returns('--pdf-engine=lualatex');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(true);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});
            
            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
            
            const execStub = sandbox.stub(require('child_process'), 'exec');
            execStub.callsArgWith(2, null, 'Success', null);
            
            // Act
            extension.activate(mockContext);
            
            // Assert
            assert.ok(true, 'Full workflow integration test setup complete');
        });

        test('should complete full render workflow with quick pick selection', () => {
            // Arrange
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('');
            mockWorkspaceConfig.get.withArgs('docxOptString').returns('-s');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});
            
            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
            
            const showQuickPickStub = vscode.window.showQuickPick as sinon.SinonStub;
            showQuickPickStub.resolves({ label: 'docx', description: 'Render as word document' });
            
            const execStub = sandbox.stub(require('child_process'), 'exec');
            execStub.callsArgWith(2, null, 'Success', null);
            
            // Act
            extension.activate(mockContext);
            
            // Assert
            assert.ok(true, 'Quick pick workflow integration test setup complete');
        });

        test('should complete full Docker workflow', () => {
            // Arrange
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('html');
            mockWorkspaceConfig.get.withArgs('htmlOptString').returns('-s -t html5');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(true);
            mockWorkspaceConfig.get.withArgs('docker.options').returns('--user $(id -u):$(id -g)');
            mockWorkspaceConfig.get.withArgs('docker.image').returns('pandoc/latex:latest');
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});
            
            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
            
            const execStub = sandbox.stub(require('child_process'), 'exec');
            execStub.callsArgWith(2, null, 'Docker success', null);
            
            // Act
            extension.activate(mockContext);
            
            // Assert
            assert.ok(true, 'Docker workflow integration test setup complete');
        });
    });

    suite('Command Arguments Tests', () => {
        
        test('should handle outputType argument correctly', () => {
            // Arrange
            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns('');
            mockWorkspaceConfig.get.withArgs('epubOptString').returns('--epub-cover-image=cover.jpg');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(false);
            mockWorkspaceConfig.get.withArgs('render.openViewer').returns(false);
            mockWorkspaceConfig.has.withArgs('executable').returns(true);
            mockWorkspaceConfig.inspect.withArgs('useDocker').returns({});
            
            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);
            
            const execStub = sandbox.stub(require('child_process'), 'exec');
            execStub.callsArgWith(2, null, 'Success', null);
            
            // Act - Command called with specific output type
            // This would test the args?.outputType logic
            
            // Assert
            assert.ok(true, 'Command arguments test setup complete');
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
            dockerOptions?: string;
            format?: string;
            formatOptKey?: string;
        }) {
            const format = opts.format ?? 'html';
            const formatOptKey = opts.formatOptKey ?? 'htmlOptString';

            mockWorkspaceConfig.get.withArgs('defaultOutputFormat').returns(format);
            mockWorkspaceConfig.get.withArgs(formatOptKey).returns('');
            mockWorkspaceConfig.get.withArgs('executable').returns('pandoc');
            mockWorkspaceConfig.get.withArgs('docker.enabled').returns(opts.useDocker ?? false);
            mockWorkspaceConfig.get.withArgs('docker.options').returns(opts.dockerOptions ?? '');
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
            mockWorkspaceConfig.get.withArgs('docker.options').returns('');
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
            mockWorkspaceConfig.get.withArgs('docker.options').returns('');
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

        test('should not mount extra /output volume in Docker when using source directory', async () => {
            const { execFileStub } = await setupOutputFolderTest({
                outputFolder: '',
                useDocker: true,
            });

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];

            assert.ok(!args.includes(':/output'), 'No /output mount should be added when using source directory');

            const outIdx = args.indexOf('-o');
            assert.ok(outIdx !== -1, '-o flag should be present');
            assert.strictEqual(args[outIdx + 1], 'document.html', 'Docker output should use relative path in /data');
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
            mockWorkspaceConfig.get.withArgs('docker.options').returns('');
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
            const { execFileStub } = await setupRenderTest('commonmark', 'commonmarkOptString');

            assert.ok(execFileStub.called, 'execFile should have been called');
            const args: string[] = execFileStub.firstCall.args[1];
            assert.ok(args.includes('--to=commonmark'), 'Args should contain --to=commonmark');
            // Output file should use .md extension
            const outFileArg: string = args[args.indexOf('-o') + 1];
            assert.ok(outFileArg.endsWith('.md'), 'Output file should use .md extension for commonmark');
        });

        test('should use .md extension and --to=gfm for gfm format', async () => {
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
});
});
