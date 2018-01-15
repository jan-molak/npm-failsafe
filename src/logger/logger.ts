export interface Logger {
    info(script_name: string, line: string);
    error(script_name: string, line: string);
}
