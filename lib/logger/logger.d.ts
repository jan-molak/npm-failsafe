export interface Logger {
    info(script_name: string, line: string): any;
    error(script_name: string, line: string): any;
}
