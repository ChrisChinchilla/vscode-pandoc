const path = require('path');
const Mocha = require('mocha');
const { glob } = require('glob');

function run() {
    const mocha = new Mocha({
        ui: 'tdd',
        color: true
    });

    const testsRoot = path.resolve(__dirname);

    return glob('**/*.test.js', { cwd: testsRoot })
        .then(files => {
            files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

            return new Promise((c, e) => {
                mocha.run(failures => {
                    if (failures > 0) {
                        e(new Error(`${failures} tests failed.`));
                    } else {
                        c();
                    }
                });
            });
        });
}

module.exports = { run };
