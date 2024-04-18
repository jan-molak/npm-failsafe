import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import * as fs from 'fs';
import readline = require('readline');
import path = require('path');

import { ArgumentParser, ParseError, Script, UnrecognisedArgumentsError } from './ArgumentParser';
import { Logger, trimmed } from './logger';

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))

export interface FailsafeConfig {
    cwd: string;
    isTTY: boolean;
}

export interface RunResult {
    exitCode: ExitCode;
    failedScripts: string[];
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

        try {
            const scripts = this.parser.parse(arguments_);

            if (scripts.length === 0) {
                this.logger.error('failsafe', trimmed`
                | Please specify which npm scripts you'd like to run, for example:
                |   npm failsafe start test
                |`
                );

                return 1;
            }

            const result = await this.runScripts(scripts);
            this.logger.info('failsafe', this.summaryOf(result));

            return result.exitCode;
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
                this.logger.error('failsafe', `Error: ${ error.message }`);
            }

            return 1;
        }
    }

    private summaryOf(result: RunResult): string {
        const plural = result.failedScripts.length > 1;

        return result.failedScripts.length === 0
            ? `Succeeded with exit code ${ result.exitCode } as all scripts passed`
            : `Failed with exit code ${ result.exitCode } due to failing script${ plural ? 's' : '' }: ${ result.failedScripts.map(s => `'${s}'`).join(', ') }`;
    }

    private async runScripts(scripts: Script[]): Promise<RunResult> {
        return await scripts.reduce(async (previous: Promise<RunResult>, script: Script) => {
            const result = await previous;
            const currentExitCode = await this.runScript(script.name, script.arguments);
            result.exitCode = Math.max(result.exitCode, currentExitCode);
            if (currentExitCode !== 0) {
                result.failedScripts.push(script.name);
            }
            return result;
        }, Promise.resolve({ exitCode: 0, failedScripts: [] } as RunResult));
    }

    private runScript(scriptName: string, arguments_: string[] = []): Promise<ExitCode> {
        return new Promise((resolve, reject) => {
            const isWindows = process.platform.startsWith('win32');

            const npmArguments = [`run`, scriptName];
            if (arguments_.length > 0) {
                npmArguments.push('--', ...arguments_);
            }

            const script = isWindows
                ? this.windowsSpawn(npmArguments)
                : this.linuxAndMacSpawn(npmArguments);

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

    private linuxAndMacSpawn(npmArguments: string[]): ChildProcessWithoutNullStreams {
        const npm = process.env.npm_execpath ?? `npm`;

        return spawn(npm, npmArguments, {
            cwd: this.config.cwd,
            env: {
                ...this.forceColorEnv(),
                ...this.env
            },
        });
    }

    private windowsSpawn(npmArguments: string[]): ChildProcessWithoutNullStreams {
        /* c8 ignore start */
        return spawn(`npm.cmd`, npmArguments.map(npmArgument => this.quoteArgumentsWithSpaces(npmArgument)), {
            cwd: this.config.cwd,
            env: {
                ...this.forceColorEnv(),
                ...this.env
            },
            shell: true,
        });
        /* c8 ignore stop */
    }

    private quoteArgumentsWithSpaces(npmArgument: string): string {
        /* c8 ignore start */
        return npmArgument.includes(' ')
            ? `"${ npmArgument }"`
            : npmArgument;
        /* c8 ignore stop */
    }

    private forceColorEnv() {
        return {
            'FORCE_COLOR': this.config.isTTY ? '1' : undefined,
        }
    }
}
