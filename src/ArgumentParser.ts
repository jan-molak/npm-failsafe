export class ArgumentParser {
    private static WILDCARD = '...';

    private scriptArguments: { [script: string]: string[] } = {};
    private mapping: { [argumentName: string]: string[] } = {};

    parse(arguments_: string[]): Array<Script> {
        // reset state
        this.scriptArguments = {};
        this.mapping = {};

        let lastScriptName = '';
        let declarationFinished = false;

        enum TOK {
            UNKNOWN,
            VALUE,
            BRACKET_OPEN,
            BRACKET_CLOSE,
            SEPARATOR,
        }

        const tokMap: { [key: string]: TOK } = {
            '[': TOK.BRACKET_OPEN,
            ']': TOK.BRACKET_CLOSE,
            ',': TOK.SEPARATOR,
        }

        const tokValuePairs = Array.from(arguments_).map(argument => [ TOK.UNKNOWN as TOK, argument ] as const);
        let lastKnownTok = TOK.UNKNOWN;
        let expectArgumentValueFor: string | null = null;
        let withinBrackets = false;
        let parsed = '';
        const unrecognisedArguments: string[] = [];
        while (tokValuePairs.length > 0) {
            const [ tok, value ] = tokValuePairs.shift() as [ TOK, string ];
            if (!declarationFinished) {
                switch (tok) {
                    case TOK.UNKNOWN: {
                        const splits = value.split(/([,[\]])/)
                            .filter(s => s !== '' && s !== undefined)
                            .map(s => s.trim()) as string[];
                        for (const split of splits.reverse()) {
                            const tok = tokMap[split] || TOK.VALUE;
                            tokValuePairs.unshift([ tok, split ] as const);
                        }
                        continue;
                    }
                    case TOK.BRACKET_OPEN: {
                        parsed += value;
                        if (withinBrackets || (lastKnownTok !== TOK.VALUE && lastKnownTok !== TOK.BRACKET_CLOSE)) {
                            throw new ParseError(`Unexpected '${ value }'`, parsed, parsed.length - value.length);
                        }
                        lastKnownTok = tok;
                        withinBrackets = true;
                        continue;
                    }
                    case TOK.BRACKET_CLOSE: {
                        if (lastKnownTok !== TOK.VALUE) {
                            throw new ParseError(`Missing argument name`, parsed, parsed.length - value.length);
                        }
                        parsed += ' ' + value + ' ';
                        lastKnownTok = tok;
                        if (!withinBrackets) {
                            throw new ParseError(`Unexpected '${ value }'`, parsed, parsed.length - value.length);
                        }
                        withinBrackets = false;
                        continue;
                    }
                    case TOK.SEPARATOR: {
                        parsed += value;
                        lastKnownTok = tok;
                        if (!withinBrackets) {
                            throw new ParseError(`Unexpected '${ value }'`, parsed, parsed.length - value.length);
                        }
                        continue;
                    }
                    case TOK.VALUE: {
                        if (withinBrackets) {
                            parsed += ' ' + value;
                            if (lastKnownTok !== TOK.BRACKET_OPEN && lastKnownTok !== TOK.SEPARATOR) {
                                throw new ParseError(`Unexpected '${ value }', expected either ',' or ']'`, parsed, parsed.length - value.length);
                            }
                            lastKnownTok = tok;
                            const argumentName = value.replace(/^--?/, '');
                            this.mapping[argumentName] = this.mapping[argumentName] ?? [];
                            if (this.mapping[argumentName].includes(lastScriptName)) {
                                throw new ParseError(`Duplicate argument '${ value }'`, parsed, parsed.length - value.length);
                            }
                            this.mapping[argumentName].push(lastScriptName);
                            continue;
                        }
                        if (!withinBrackets && !value.startsWith('-')) {
                            this.scriptArguments[value] = this.scriptArguments[value] ?? [];
                            lastScriptName = value;
                            parsed += value + ' ';
                            lastKnownTok = tok;
                            continue;
                        }
                        declarationFinished = true;
                        if (value === '--') {
                            parsed += value + ' ';
                            lastKnownTok = tok;
                            continue;
                        }
                    }
                }
            }
            parsed += value + ' ';
            lastKnownTok = tok;

            const argument = value;
            let argumentName = argument.replaceAll(/^--?|=.*$/g, '');
            const argumentValue = argument.replace(/^[^=]*=?/, '');
            if (argumentName === argument) {
                argumentName = ''
            }
            if (!argument.startsWith('-') && expectArgumentValueFor !== null) {
                argumentName = expectArgumentValueFor;
            }
            const scriptNames = (argumentName === ''
                ? undefined
                : this.mapping[argumentName]
            ) ?? this.mapping[ArgumentParser.WILDCARD] ?? undefined;

            if (scriptNames) {
                for (const scriptName of scriptNames) {
                    this.scriptArguments[scriptName] = this.scriptArguments[scriptName] ?? [];
                    this.scriptArguments[scriptName].push(argument);
                }
            } else {
                unrecognisedArguments.push(argument);
            }

            if (argument.startsWith('-') && argumentName.length > 1 && argumentValue === '') {
                // multi-character arguments might have values
                expectArgumentValueFor = argumentName;
            } else if (argument.startsWith('-') && argumentName.length === 1) {
                // single character arguments do not have values
                expectArgumentValueFor = null;
            }
        }

        if (withinBrackets) {
            throw new ParseError(`Missing ']'`, parsed, parsed.length + 1);
        }

        if (unrecognisedArguments.length > 0) {
            throw new UnrecognisedArgumentsError(
                `Unrecognised arguments: ${ unrecognisedArguments.join(' ') }`,
                this.recommendCommand(unrecognisedArguments),
            );
        }

        return Object.keys(this.scriptArguments).map(scriptName => ({
            name: scriptName,
            arguments: this.scriptArguments[scriptName],
        }));
    }

    protected recommendCommand(unrecognisedArguments: string[]): string {
        const result = [ 'failsafe' ]
        const scriptNames = Object.keys(this.scriptArguments);

        for (let i = 0; i < scriptNames.length; i++) {
            const scriptName = scriptNames[i];
            result.push(scriptName);
            const argumentsForScript = Object.entries(this.mapping)
                .filter(([ argumentName, scriptNames ]) => scriptNames.includes(scriptName))
                .map(([ argumentName ]) =>
                    argumentName === ArgumentParser.WILDCARD
                        ? argumentName
                        : (argumentName.length === 1 ? `-${ argumentName }` : `--${ argumentName }`)
                );

            if (i === Math.min(1, scriptNames.length - 1)) {
                argumentsForScript.push(...unrecognisedArguments);
            }
            if (argumentsForScript.length > 0) {
                const argumentPattern = []
                let wildcard = false;
                let expectArgumentValue = false;
                for (const value of argumentsForScript) {
                    if (value.startsWith('-')) {
                        const argumentName = value.replaceAll(/^--?|=.*$/g, '');
                        const argumentValue = value.replace(/^[^=]*=?/, '');
                        argumentPattern.push(argumentName.length === 1 ? `-${ argumentName }` : `--${ argumentName }`);
                        expectArgumentValue = argumentName.length > 1 && argumentValue === ''
                    } else if (!expectArgumentValue) {
                        wildcard = true;
                    }
                }
                if (wildcard) {
                    argumentPattern.push(ArgumentParser.WILDCARD);
                }
                result.push(`[${ argumentPattern.join(',') }]`);
            }
        }

        return result.join(' ');
    }
}

export interface Script {
    name: string;
    arguments: string[];
}

export class ParseError extends Error {
    constructor(message: string, readonly parsed: string, readonly position: number) {
        super(message);
    }
}

export class UnrecognisedArgumentsError extends Error {
    constructor(message: string, public readonly recommendedScript: string) {
        super(message);
    }
}