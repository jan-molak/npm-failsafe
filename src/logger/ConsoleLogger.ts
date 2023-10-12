import { Logger } from './Logger';

export class ConsoleLogger implements Logger {
    help(line: string): void {
        console.log(line);
    }

    info(script_name: string, message: string): void {
        console.info(`[${script_name}] ${message}`);
    }

    error(script_name: string, message: string): void {
        console.error(`[${script_name}] ${message}`);
    }
}
