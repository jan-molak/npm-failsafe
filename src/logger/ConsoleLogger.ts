import { Logger } from './Logger';

export class ConsoleLogger implements Logger {
    info(script_name: string, message: string): void {
        console.info(`[${script_name}] ${message}`);
    }

    error(script_name: string, message: string): void {
        console.error(`[${script_name}] ${message}`);
    }
}
