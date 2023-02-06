export interface Logger {
    info(script_name: string, line: string): void;
    error(script_name: string, line: string): void;
}
