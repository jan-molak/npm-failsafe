'use strict';
const exec = require('child_process').exec;
const tto = require('terminal-table-output')

function failsafe(scripts) {
    runAll(splitArray(scripts, '--')).then(
        () => {
            process.exit(0)
        },
        (errors) => {
            print(errors);

            process.exit(1);
        }
    );
}

function runAll(scripts, args) {
    let errors = [];

    return scripts
        .reduce((previous, script) => previous.then(
            () => run(script, args).catch(error => {
                errors.push({ script: script, error: error });
            }),

            (error) => {
                errors.push({ script: script, error: error });

                return run(script);
            }),

            Promise.resolve())
        .then(() => {
            if (errors.length > 0) {
                throw errors;
            }
        });
}

function run(script, args) {
    return new Promise( (resolve, reject) => {
        exec(`npm run ${script}`, (err) => {
            if (err) {
                reject(err);
            }

            resolve();
        });
    });
}

function print(results) {

    let summary = results
        .reduce(
            (table, result) => table.pushrow([ result.script, singleLine(result.error.message) ]),
            tto.create().line()
        );

    console.error('Some of the npm scripts have failed:');
    console.error(summary.print())
}

function singleLine(string) {
    return string.replace('\n', ' ');
}

function splitArray(array, splitter) {
    let index = array.indexOf(splitter);
    if (index === -1) {
        return array;
    }

    const argless = array.slice(0, index - 1);
    const argful = array.slice(index - 1, array.length).join(' ');

    return argless.concat(argful);
}

module.exports = failsafe;