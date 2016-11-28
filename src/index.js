'use strict';

let npm    = require('npm'),
    tto    = require('terminal-table-output')

function failsafe(scripts) {
    npm.load({}, (err) => {
        if (err) {
            console.error(err);
            exit(1);
        }

        runAll(...splitArray(scripts, '--')).then(
            () => {
                process.exit(0)
            },
            (errors) => {
                print(errors);

                process.exit(1);
            }
        );
    });
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
        npm.commands.run([ script, ...args ], error => {
            if (error) {
                reject(error);
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
    if (index !== -1) {
        return [ array.slice(0, index), array.slice(index + 1) ];
    }
    return [ array, [] ];
}

module.exports = failsafe;
