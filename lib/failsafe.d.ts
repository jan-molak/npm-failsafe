import { Logger } from './logger/logger';
export interface FailsafeConfig {
    cwd: string;
}
export declare type ExitCode = number;
export declare class Failsafe {
    private readonly logger;
    private readonly config;
    constructor(logger: Logger, config: FailsafeConfig);
    run(scripts_names: string[]): Promise<ExitCode>;
    private runScript(script_name);
}
