import { spawn } from 'child_process';
import * as fs from 'fs';
import readline = require('readline');

import { Logger, trimmed } from './logger';
import path = require('path');
import { ArgumentParser, ParseError, Script, UnrecognisedArgumentsError } from './ArgumentParser';

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))

export interface FailsafeConfig {
    cwd: string;
    isTTY: boolean;
}

export type ExitCode = number;

export class Failsafe {

    private parser = new ArgumentParser();

    constructor(
        private readonly logger: Logger,
        private readonly config: FailsafeConfig,
        private readonly env: typeof process.env,
    ) {
    }

    async help(): Promise<ExitCode> {
        this.logger.help(trimmed`
            | Usage: failsafe [options]
            | 
            | Description:
            |    Executes a sequence of npm scripts and returns
            |    the correct exit code should any of them fail.
            | 
            | Example:
            |    Given you have the following npm scripts defined:
            |        "scripts": {
            |            "clean": "rimraf target",
            |            "test": "failsafe clean test:playwright [--spec,...] test:report [--destination]",
            |            "test:playwright": "playwright test",
            |            "test:report": "serenity-bdd run",
            |        }
            | 
            |    When you run the following command:
            |        npm run test -- --spec "spec/**/*.spec.ts" --destination=reports
            | 
            |    Then all the following commands are executed in a sequence
            |    and the highest exit code is returned:
            |        1. rimraf target
            |        2. playwright test --spec spec/**/*.spec.ts
            |        3. serenity-bdd run --destination=reports
            | 
            | Info:
            |   Version: ${ packageJson.version }
            |   Author: ${ packageJson.author }
            |   License: ${ packageJson.license }
            |   Homepage: ${ packageJson.homepage }
            |`
        );

        return 0;
    }

    async run(arguments_: string[]): Promise<ExitCode> {

        if (arguments_.length === 1 && ['--help','-help','-h','-usage','--usage'].includes(arguments_[0])) {
            return this.help();
        }

        let scripts: Script[];

        try {
            scripts = this.parser.parse(arguments_);
        }
        catch (error: any) {
            if (error instanceof ParseError) {
                this.logger.error('failsafe', trimmed`
                    | Error: ${ error.message } at position ${ error.position }:
                    |   ${ error.parsed }
                    |   ${ '-'.repeat(Math.max(0, error.position - 1)) }^
                    |`);
            }
            else if (error instanceof UnrecognisedArgumentsError) {
                this.logger.error('failsafe', trimmed`
                    | Error: ${ error.message }
                    | Notice: To configure your project to recognize them you might want
                    |         to change your package.json scripts to something like:
                    |             "scripts": {
                    |                 "script": "${ error.recommendedScript }",
                    |             }
                    |         For details see: ${ packageJson.homepage }
                    |`);
            }
            else {
                // istanbul ignore next
                this.logger.error('failsafe', `Error: ${ error.message }`);
            }

            return 1;
        }

        if (scripts.length === 0) {
            this.logger.error('failsafe', trimmed`
                | Please specify which npm scripts you'd like to run, for example:
                |   npm failsafe start test
                |`
            );

            return 1;
        }

        return scripts.reduce((previous: Promise<ExitCode>, script: Script) => {
            return previous
                .then(previous_exit_code =>
                    this.runScript(script.name, script.arguments)
                        .then(current_exit_code => Math.max(previous_exit_code, current_exit_code))
                );
        }, Promise.resolve(0));
    }

    private runScript(scriptName: string, arguments_: string[] = []): Promise<ExitCode> {
        return new Promise((resolve, reject) => {
            const npm = process.platform.startsWith('win32')
                ? `npm.cmd`
                : (process.env.npm_execpath ?? `npm`);

            const npmArguments = [`run`, scriptName];
            if (arguments_.length > 0) {
                npmArguments.push('--', ...arguments_);
            }
            const script = spawn(npm, npmArguments, {
                cwd: this.config.cwd,
                env: {
                    'FORCE_COLOR': this.config.isTTY ? '1' : undefined,
                    ...this.env
                }
            });

            const
                stdout = readline.createInterface({ input: script.stdout }),
                stderr = readline.createInterface({ input: script.stderr });

            stdout.on('line', line => this.logger.info(scriptName, line));
            stderr.on('line', line => this.logger.error(scriptName, line));

            script.once ('close', (code: number | null) => {
                stdout.close();
                stderr.close();

                this.logger.info('failsafe', `Script '${scriptName}' exited with code ${code}`);

                resolve(code ?? 0);
            });
        });
    }
}
