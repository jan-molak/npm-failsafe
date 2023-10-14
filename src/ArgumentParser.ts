export class ArgumentParser {
    private scriptArguments: {[ script: string ]: string[] } = {};
    private mapping: { [ argumentName: string ]: string[] } = {};

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

        const tokMap: {[key: string]: TOK} = {
            '[': TOK.BRACKET_OPEN,
            ']': TOK.BRACKET_CLOSE,
            ',': TOK.SEPARATOR,
        }

        const tokValuePairs = Array.from(arguments_).map(argument => [ TOK.UNKNOWN as TOK, argument ] as const);
        let lastKnownTok = TOK.UNKNOWN;
        let expectArgumentValueFor: string | null = null;
        let withinBrackets = false;
        let parsed = '';
        const unrecognizedArguments: string[] = [];
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
                            throw new ParseError(`Unexpected '${value}'`, parsed, parsed.length - value.length);
                        }
                        lastKnownTok = tok;
                        withinBrackets = true;
                        continue;
                    }
                    case TOK.BRACKET_CLOSE: {
                        if (lastKnownTok !== TOK.VALUE) {
                            throw new ParseError(`Missing argument name`, parsed, parsed.length - value.length);
                        }
                        parsed += ' '+value+' ';
                        lastKnownTok = tok;
                        if (!withinBrackets) {
                            throw new ParseError(`Unexpected '${value}'`, parsed, parsed.length - value.length);
                        }
                        withinBrackets = false;
                        continue;
                    }
                    case TOK.SEPARATOR: {
                        parsed += value;
                        lastKnownTok = tok;
                        if (!withinBrackets) {
                            throw new ParseError(`Unexpected '${value}'`, parsed, parsed.length - value.length);
                        }
                        continue;
                    }
                    case TOK.VALUE: {
                        if (withinBrackets) {
                            parsed += ' '+value;
                            if (lastKnownTok !== TOK.BRACKET_OPEN && lastKnownTok !== TOK.SEPARATOR) {
                                throw new ParseError(`Unexpected '${value}', expected either ',' or ']'`, parsed, parsed.length - value.length);
                            }
                            lastKnownTok = tok;
                            const argname = value.replace(/^--?/, '');
                            this.mapping[argname] = this.mapping[argname] ?? [];
                            this.mapping[argname].push(lastScriptName);
                            continue;
                        }
                        if (!withinBrackets && !value.startsWith('-')) {
                            this.scriptArguments[value] = this.scriptArguments[value] ?? [];
                            lastScriptName = value;
                            parsed += value+' ';
                            lastKnownTok = tok;
                            continue;
                        }
                        declarationFinished = true;
                        if (value === '--') {
                            parsed += value+' ';
                            lastKnownTok = tok;
                            continue;
                        }
                    }
                }
            }
            parsed += value+' ';
            lastKnownTok = tok;

            const argument = value;
            let argumentName = argument.replaceAll(/^--?|=.*$/g, '');
            const argvalue = argument.replace(/^[^=]*=?/, '');
            if (argumentName === argument) {
                argumentName = ''
            }
            if (!argument.startsWith('-') && expectArgumentValueFor !== null) {
                argumentName = expectArgumentValueFor;
            }
            const scriptNames = (argumentName === '' ? undefined : this.mapping[argumentName]) ?? this.mapping['...'] ?? undefined;
            if (scriptNames) {
                for (const scriptName of scriptNames) {
                    this.scriptArguments[scriptName] = this.scriptArguments[scriptName] ?? [];
                    this.scriptArguments[scriptName].push(argument);
                }
            }
            else {
                unrecognizedArguments.push(argument);
            }

            if (argument.startsWith('-') && argumentName.length > 1 && argvalue === '') {
                // multi-character arguments might have values
                expectArgumentValueFor = argumentName;
            }
            else if (argument.startsWith('-') && argumentName.length === 1) {
                // single character arguments do not have values
                expectArgumentValueFor = null;
            }
        }

        if (withinBrackets) {
            throw new ParseError(`Missing ']'`, parsed, parsed.length + 1);
        }

        if (unrecognizedArguments.length > 0) {
            throw new UnrecognisedArgumentsError(
                `Unrecognised arguments: ${unrecognizedArguments.join(' ')}`,
                this.recommendCommand(unrecognizedArguments)
            );
        }

        return Object.keys(this.scriptArguments).map(scriptName => ({
            name: scriptName,
            arguments: this.scriptArguments[scriptName],
        }));
    }

    protected recommendCommand(unrecognizedArguments: string[]): string {
        const result = ['failsafe']
        const scriptNames = Object.keys(this.scriptArguments);

        for (let i = 0; i < scriptNames.length; i++) {
            const scriptName = scriptNames[i];
            result.push(scriptName);
            const argumentsForScript = Object.entries(this.mapping)
                .filter(([argname, scriptNames]) => scriptNames.includes(scriptName))
                .map(([argname]) => argname === '...' ? argname : (argname.length == 1 ? `-${argname}` : `--${argname}`));
            if (i == Math.min(1, scriptNames.length - 1)) {
                argumentsForScript.push(...unrecognizedArguments);
            }
            if (argumentsForScript.length > 0) {
                const argumentPattern = []
                let wildcard = false;
                let expectArgumentValue = false;
                for (const value of argumentsForScript) {
                    if (value.startsWith('-')) {
                        const argname = value.replaceAll(/^--?|=.*$/g, '');
                        const argvalue = value.replace(/^[^=]*=?/, '');
                        argumentPattern.push(argname.length == 1 ? `-${argname}` : `--${argname}`);
                        expectArgumentValue = argname.length > 1 && argvalue === ''
                    } else if (!expectArgumentValue) {
                        wildcard = true;
                    }
                }
                if (wildcard) {
                    argumentPattern.push('...')
                }
                result.push(`[${argumentPattern.join(',')}]`);
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