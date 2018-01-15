import { Logger } from './logger';
export declare class ConsoleLogger implements Logger {
    info(script_name: string, message: string): void;
    error(script_name: string, message: string): void;
}
