export abstract class Logger {
    abstract info(script_name: string, line: string): void;
    abstract error(script_name: string, line: string): void;
    abstract help(line: string): void;

    protected prefixed(scriptName: string, message: string): string {
        return message.split('\n')
            .map(line => `[${ scriptName }] ${ line }`)
            .join('\n');
    }
}
