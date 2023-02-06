import { Logger } from './logger';

export class ConsoleLogger implements Logger {
    info(script_name: string, message: string): void {
        // tslint:disable-next-line:no-console
        console.info(`[${script_name}] ${message}`);
    }

    error(script_name: string, message: string): void {
        // tslint:disable-next-line:no-console
        console.error(`[${script_name}] ${message}`);
    }
}
