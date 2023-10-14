import { Logger } from './Logger';

export class ConsoleLogger extends Logger {
    help(line: string): void {
        console.log(line);
    }

    info(scriptName: string, message: string): void {
        console.info(
            this.prefixed(scriptName, message)
        );
    }

    error(scriptName: string, message: string): void {
        console.error(
            this.prefixed(scriptName, message)
        );
    }
}
