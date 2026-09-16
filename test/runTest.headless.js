#!/usr/bin/env node

const path = require('path');
const { runTests } = require('@vscode/test-electron');

async function main() {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, '../');
        const extensionTestsPath = path.resolve(__dirname, '../out/test/suites/index');
        const extensionTestsEnv = { ...process.env };

        // Do not let an enclosing VS Code extension host force the downloaded
        // desktop executable into Node mode; see runTest.js for details.
        delete process.env.ELECTRON_RUN_AS_NODE;
        delete extensionTestsEnv.ELECTRON_RUN_AS_NODE;

        // For CI environments, run in headless mode
        const launchArgs = process.env.CI 
            ? ['--disable-extensions', '--headless'] 
            : [];

        // Forward the parent environment (in particular NODE_V8_COVERAGE,
        // set by `c8` when wrapping this script) into the spawned Extension
        // Host process -- see runTest.js for why this is needed for coverage.
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs,
            extensionTestsEnv
        });
    } catch (err) {
        console.error('Failed to run tests');
        console.error(err);
        process.exit(1);
    }
}

main();
