const path = require('path');
const { runTests } = require('@vscode/test-electron');
// TODO: Good start with tests but some need better factoring and logic to actually test for certain situations, i.e. Docker.
async function main() {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, '../');
        const extensionTestsPath = path.resolve(__dirname, '../out/test/suites/index');

        // Forward the parent process's environment (in particular
        // NODE_V8_COVERAGE, set by `c8` when wrapping this script) into the
        // spawned Extension Host process. That's where src/*.ts-compiled
        // code actually executes, and V8 coverage collection is per-process
        // -- without this, `c8`'s env var would only apply to this launcher
        // process, not the one running the tests.
        await runTests({ extensionDevelopmentPath, extensionTestsPath, extensionTestsEnv: process.env });
    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();
