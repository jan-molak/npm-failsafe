import { spawn } from 'child_process';
import readline = require('readline');

import { Logger } from './logger';

export interface FailsafeConfig {
    cwd: string;
    isTTY: boolean;
}

export type ExitCode = number;
export class Failsafe {

    constructor(
        private readonly logger: Logger,
        private readonly config: FailsafeConfig,
        private readonly env: typeof process.env,
    ) {
    }

    async run(arguments_: string[]): Promise<ExitCode> {
        const scriptArguments: {[script: string]: string[]} = {};
        try {
            this.parseArguments(arguments_, scriptArguments);
        } catch (error: any) {
            this.logger.error('failsafe', `${error}`);
            return 1;
        }

        const scriptsName = Object.keys(scriptArguments);

        if (scriptsName.length === 0) {
            this.logger.error('failsafe', [
                `Please specify which npm scripts you'd like to run, for example:`,
                `  npm failsafe start test`
            ].join('\n'));

            return 1;
        }

        return scriptsName.reduce((previous: Promise<ExitCode>, script_name: string) => {
            return previous
                .then(previous_exit_code => this.runScript(script_name, scriptArguments[script_name])
                    .then(current_exit_code => Math.max(previous_exit_code, current_exit_code)));
        }, Promise.resolve(0));
    }

    private runScript(script_name: string, arguments_: string[] = []): Promise<ExitCode> {
        return new Promise((resolve, reject) => {
            const npm = process.platform.startsWith('win32')
                ? `npm.cmd`
                : `npm`;

            const npmArguments = [`run`, script_name];
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

            stdout
                .on('line', line => this.logger.info(script_name, line));
            stderr
                .on('line', line => this.logger.error(script_name, line));

            script.once ('close', (code: number | null) => {
                stdout.close();
                stderr.close();

                this.logger.info('failsafe', `Script '${script_name}' exited with code ${code}`);

                resolve(code ?? 0);
            });
        });
    }

    private parseArguments(arguments_: string[], scriptArguments: {[script: string]: string[]}): void {
        const mapping: {[argname: string]: string} = {};
        let lastScriptName = '';
        let declarationFinished = false;
        const argumentList = Array.from(arguments_);
        while (argumentList.length > 0) {
            const argument = argumentList.shift() as string;
            if (!declarationFinished) {
                if (argument === '[...]') {
                    mapping['...'] = lastScriptName;
                    continue;
                }
                if (argument.startsWith('[') && argument.endsWith(']')) {
                    // [--foo]
                    const argname = argument.replaceAll(/^\[-?-?|]$/g, '');
                    mapping[argname] = lastScriptName;
                    continue;
                }
                if (!argument.startsWith('-')) {
                    // script-name[--foo][--bar] -> script-name [--foo] [--bar]
                    const [ scriptName, ...interleavedArguments ] = argument.split(/(\[.+?])/).filter(s => s !== '' && s !== undefined);
                    if (!scriptName) {
                        throw new Error(`Unknown argument '${argument}'`);
                    }
                    scriptArguments[scriptName] = scriptArguments[scriptName] ?? [];
                    lastScriptName = scriptName;
                    argumentList.unshift(...interleavedArguments);
                    continue;
                }
                if (argument == '--') {
                    declarationFinished = true;
                    continue;
                }
            }

            declarationFinished = true;
            const argname = argument.replaceAll(/^--?|=.*$/g, '');
            const scriptName = mapping[argname] ?? mapping['...'] ?? undefined;
            if (scriptName) {
                scriptArguments[scriptName] = scriptArguments[scriptName] ?? [];
                scriptArguments[scriptName].push(argument);
            }
            else {
                throw new Error(`Unknown argument '${argument}'`);
            }
        }
    }
}
