import { spawn } from 'child_process';
import readline = require('readline');

import { Logger } from './logger';

export interface FailsafeConfig {
    cwd: string;
}

export type ExitCode = number;
export class Failsafe {

    constructor(
        private readonly logger: Logger,
        private readonly config: FailsafeConfig) {
    }

    run(scripts_names: string[]): Promise<ExitCode> {
        return scripts_names.reduce((previous: Promise<ExitCode>, script_name: string) => {
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
                env: process.env,
            });

            const
                stdout = readline.createInterface({ input: script.stdout }),
                stderr = readline.createInterface({ input: script.stderr });

            stdout
                .on('line', line => this.logger.info(script_name, line));
            stderr
                .on('line', line => this.logger.error(script_name, line));

            script.on('close', code => {
                stdout.close();
                stderr.close();

                this.logger.info('failsafe', `Script '${script_name}' exited with code ${code}`);

                resolve(code);
            });
        });
    }
}
