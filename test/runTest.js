const path = require('path');
const { runTests } = require('@vscode/test-electron');
// TODO: Good start with tests but some need better factoring and logic to actually test for certain situations, i.e. Docker.
async function main() {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, '../');
        const extensionTestsPath = path.resolve(__dirname, '../out/test/suites/index');

        await runTests({ extensionDevelopmentPath, extensionTestsPath });
    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();
