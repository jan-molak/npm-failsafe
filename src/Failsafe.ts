import { spawn } from 'child_process';
import * as fs from 'fs';
import readline = require('readline');

import { Logger, trimmed } from './logger';
import path = require('path');

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))

export interface FailsafeConfig {
    cwd: string;
    isTTY: boolean;
}

export type ExitCode = number;
export class Failsafe {

    protected scriptArguments: {[script: string]: string[]} = {};
    protected mapping: {[argname: string]: string[]} = {};

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
            this.parseArguments(arguments_);
        }
        catch (error: any) {
            if (error instanceof ParseError) {
                this.logger.error('failsafe', trimmed`
                    | Error: ${ error.message } at position ${ error.position }:
                    |   ${ error.parsed }
                    |   ${ '-'.repeat(Math.max(0, error.position - 1)) }^
                    |`);
            }
            else if (error instanceof UnrecognizedArgumentsError) {
                this.logger.error('failsafe', trimmed`
                    | Error: ${ error.message }
                    | Notice: To configure your project to recognize them you might want
                    |         to change your package.json scripts to something like:
                    |             "scripts": {
                    |                 "script": ${ JSON.stringify(this.recommendCommand(error.unrecognizedArguments)) },
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

        const scriptNames = Object.keys(this.scriptArguments);

        if (scriptNames.length === 0) {
            this.logger.error('failsafe', trimmed`
                | Please specify which npm scripts you'd like to run, for example:
                |   npm failsafe start test
                |`
            );

            return 1;
        }

        return scriptNames.reduce((previous: Promise<ExitCode>, scriptName: string) => {
            return previous
                .then(previous_exit_code =>
                    this.runScript(scriptName, this.scriptArguments[scriptName])
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

    protected recommendCommand(unrecognizedArguments: string[]): string {
        const result = ['failsafe']
        const scriptNames = Object.keys(this.scriptArguments);

        for (let i = 0; i < scriptNames.length; i++) {
            const scriptName = scriptNames[i];
            result.push(scriptName);
            const argumentsForScript = Object.entries(this.mapping)
                .filter(([argname, scriptNames]) => scriptNames.includes(scriptName))
                .map(([argname]) => argname === '...' ? argname : (argname.length == 1 ? `-${argname}` : `--${argname}`));
            if (i == Math.min(1, scriptNames.length - 1)) {
                argumentsForScript.push(...unrecognizedArguments);
            }
            if (argumentsForScript.length > 0) {
                const argumentPattern = []
                let wildcard = false;
                let expectArgumentValue = false;
                for (const value of argumentsForScript) {
                    if (value.startsWith('-')) {
                        const argname = value.replaceAll(/^--?|=.*$/g, '');
                        const argvalue = value.replace(/^[^=]*=?/, '');
                        argumentPattern.push(argname.length == 1 ? `-${argname}` : `--${argname}`);
                        expectArgumentValue = argname.length > 1 && argvalue === ''
                    } else if (!expectArgumentValue) {
                        wildcard = true;
                    }
                }
                if (wildcard) {
                    argumentPattern.push('...')
                }
                result.push(`[${argumentPattern.join(',')}]`);
            }
        }

        return result.join(' ');
    }

    protected parseArguments(arguments_: string[]): void {
        // reset state
        this.scriptArguments = {};
        this.mapping = {};

        let lastScriptName = '';
        let declarationFinished = false;

        enum TOK {
            UNKNOWN,
            VALUE,
            BRACKET_OPEN,
            BRACKET_CLOSE,
            SEPARATOR,
        }

        const tokMap: {[key: string]: TOK} = {
            '[': TOK.BRACKET_OPEN,
            ']': TOK.BRACKET_CLOSE,
            ',': TOK.SEPARATOR,
        }

        const tokValuePairs = Array.from(arguments_).map(argument => [ TOK.UNKNOWN as TOK, argument ] as const);
        let lastKnownTok = TOK.UNKNOWN;
        let expectArgumentValueFor: string | null = null;
        let withinBrackets = false;
        let parsed = '';
        const unrecognizedArguments: string[] = [];
        while (tokValuePairs.length > 0) {
            const [ tok, value ] = tokValuePairs.shift() as [ TOK, string ];
            if (!declarationFinished) {
                switch (tok) {
                    case TOK.UNKNOWN: {
                        const splits = value.split(/([,[\]])/)
                            .filter(s => s !== '' && s !== undefined)
                            .map(s => s.trim()) as string[];
                        for (const split of splits.reverse()) {
                            const tok = tokMap[split] || TOK.VALUE;
                            tokValuePairs.unshift([ tok, split ] as const);
                        }
                        continue;
                    }
                    case TOK.BRACKET_OPEN: {
                        parsed += value;
                        if (withinBrackets || (lastKnownTok !== TOK.VALUE && lastKnownTok !== TOK.BRACKET_CLOSE)) {
                            throw new ParseError(`Unexpected '${value}'`, parsed, parsed.length - value.length);
                        }
                        lastKnownTok = tok;
                        withinBrackets = true;
                        continue;
                    }
                    case TOK.BRACKET_CLOSE: {
                        if (lastKnownTok !== TOK.VALUE) {
                            throw new ParseError(`Missing some argument`, parsed, parsed.length - value.length);
                        }
                        parsed += ' '+value+' ';
                        lastKnownTok = tok;
                        if (!withinBrackets) {
                            throw new ParseError(`Unexpected '${value}'`, parsed, parsed.length - value.length);
                        }
                        withinBrackets = false;
                        continue;
                    }
                    case TOK.SEPARATOR: {
                        parsed += value;
                        lastKnownTok = tok;
                        if (!withinBrackets) {
                            throw new ParseError(`Unexpected '${value}'`, parsed, parsed.length - value.length);
                        }
                        continue;
                    }
                    case TOK.VALUE: {
                        if (withinBrackets) {
                            parsed += ' '+value;
                            if (lastKnownTok !== TOK.BRACKET_OPEN && lastKnownTok !== TOK.SEPARATOR) {
                                throw new ParseError(`Unexpected '${value}', expected either ',' or ']'`, parsed, parsed.length - value.length);
                            }
                            lastKnownTok = tok;
                            const argname = value.replace(/^--?/, '');
                            this.mapping[argname] = this.mapping[argname] ?? [];
                            this.mapping[argname].push(lastScriptName);
                            continue;
                        }
                        if (!withinBrackets && !value.startsWith('-')) {
                            this.scriptArguments[value] = this.scriptArguments[value] ?? [];
                            lastScriptName = value;
                            parsed += value+' ';
                            lastKnownTok = tok;
                            continue;
                        }
                        declarationFinished = true;
                        if (value === '--') {
                            parsed += value+' ';
                            lastKnownTok = tok;
                            continue;
                        }
                    }
                }
            }
            parsed += value+' ';
            lastKnownTok = tok;

            const argument = value;
            let argname = argument.replaceAll(/^--?|=.*$/g, '');
            const argvalue = argument.replace(/^[^=]*=?/, '');
            if (argname === argument) {
                argname = ''
            }
            if (!argument.startsWith('-') && expectArgumentValueFor !== null) {
                argname = expectArgumentValueFor;
            }
            const scriptNames = (argname === '' ? undefined : this.mapping[argname]) ?? this.mapping['...'] ?? undefined;
            if (scriptNames) {
                for (const scriptName of scriptNames) {
                    this.scriptArguments[scriptName] = this.scriptArguments[scriptName] ?? [];
                    this.scriptArguments[scriptName].push(argument);
                }
            }
            else {
                unrecognizedArguments.push(argument);
            }

            if (argument.startsWith('-') && argname.length > 1 && argvalue === '') {
                // multi-character arguments might have values
                expectArgumentValueFor = argname;
            }
            else if (argument.startsWith('-') && argname.length === 1) {
                // single character arguments do not have values
                expectArgumentValueFor = null;
            }
        }
        if (withinBrackets) {
            throw new ParseError(`Missing ']'`, parsed, parsed.length + 1);
        }
        if (unrecognizedArguments.length > 0) {
            throw new UnrecognizedArgumentsError(`Unrecognized arguments: ${unrecognizedArguments.join(' ')}`, unrecognizedArguments);
        }
    }
}

class ParseError extends Error {
    constructor(message: string, readonly parsed: string, readonly position: number) {
        super(message);
    }
}
class UnrecognizedArgumentsError extends Error {
    constructor(message: string, readonly unrecognizedArguments: string[]) {
        super(message);
    }
}