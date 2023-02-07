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

    async run(scriptsName: string[]): Promise<ExitCode> {
        if (scriptsName.length === 0) {
            this.logger.error('failsafe', [
                `Please specify which npm scripts you'd like to run, for example:`,
                `  npm failsafe start test`
            ].join('\n'));

            return 1;
        }

        return scriptsName.reduce((previous: Promise<ExitCode>, script_name: string) => {
            return previous
                .then(previous_exit_code => this.runScript(script_name)
                    .then(current_exit_code => Math.max(previous_exit_code, current_exit_code)));
        }, Promise.resolve(0));
    }

    private runScript(script_name: string): Promise<ExitCode> {
        return new Promise((resolve, reject) => {
            const npm = process.platform.startsWith('win') ? `npm.cmd` : `npm`;

            const script = spawn(npm, [`run`, script_name], {
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
}
