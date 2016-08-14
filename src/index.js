'use strict';

const npm = require('npm'),
    format = require('util').format;

class Results {

    constructor(_scripts_) {
        this.results = _scripts_.reduce( (acc, script) => {
            acc[script] = null;

            return acc;
        }, {});
    }

    finished(script, error) {
        this.results[script] = error || 'success';
    }

    allFinished() {
        return Object.keys(this.results).reduce( (done, script) => {
            return done && this.results[script];
        }, true);
    }

    allSuccessful() {
        Object.keys(this.results).reduce( (result, script) => {
            return result && ! (this.results[script] instanceof Error);
        }, true);
    }

    summary() {
        return this.results;
    }
}

class ErrorPrinter {
    print(summary) {
        let template = '%s\t| %s';

        console.log('------------------------------------');
        console.log('Some of the npm scripts have failed:');
        console.log('------------------------------------');
        console.log(format(template, 'script', 'result'))
        console.log('------------------------------------');

        Object.keys(summary).forEach( script => {
            let result = summary[script];

            if (result instanceof Error) {
                console.error(format(template, script, result.message));
            } else {
                console.log(format(template, script, result));
            }
        });
    }
}

module.exports = (scripts) => {

    let results = new Results(scripts),
        printer = new ErrorPrinter();

    npm.load({}, (err) => {
        if (err) {
            console.error(err);
            exit(1);
        }

        scripts.forEach(script => {
            npm.commands.run([script], error => {
                results.finished(script, error);

                if (results.allFinished()) {
                    if (results.allSuccessful()) {
                        process.exit(0);
                    } else {
                        printer.print(results.summary());
                        process.exit(1);
                    }
                }
            });
        });
    });
};