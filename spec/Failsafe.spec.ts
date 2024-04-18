import 'mocha';

import { given } from 'mocha-testdata';

import { ExitCode, Failsafe, FailsafeConfig } from '../src/Failsafe';
import { Logger } from '../src/logger';
import { expect } from './expect';
import path = require('path');

describe(`Failsafe`, function() {
    this.timeout(5000);

    const
        Success = 0,
        General_Failure = 1,
        Other_Failure = 7;

    it(`exits with error when no scripts are specified`, async () => {
        const { run, logger } = failsafe();

        const exitCode = await run([]);

        expect(exitCode).to.equal(General_Failure);

        expect(logger.stderr()).to.include([
            `[failsafe] Please specify which npm scripts you'd like to run, for example:`,
            `[failsafe]   npm failsafe start test`,
        ].join('\n'));
    });

    describe(`Help`, () => {

        it(`shows a help/usage message when run with --help argument`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`--help`]);

            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include('Usage: failsafe');
        });
    });

    describe(`Returns with an exit code of the executed script, when:`, () => {
        it(`finishes with a success`, () => {
            return expect(failsafe().run([`success`])).to.eventually.equal(Success);
        });

        it(`finishes with a general failure`, () => {
            return expect(failsafe().run([`general-failure`])).to.eventually.equal(General_Failure);
        });
    });

    given(
        { scripts: [`success`, `success`], expected_result: Success },
        { scripts: [`success`, `general-failure`], expected_result: General_Failure },
        { scripts: [`general-failure`, `general-failure`], expected_result: General_Failure },
        { scripts: [`general-failure`, `success`], expected_result: General_Failure },
    ).
    it(`returns with the worst exit code encountered`, async ({ scripts, expected_result }) => {
        const { run, logger } = failsafe();
        const exitCode = await run(scripts);

        expect(exitCode).to.equal(expected_result, `Expected exit code of ${expected_result}${ format(logger) }`);
    });

    describe(`Logging`, () => {

        it(`reports the stdout, prefixing each line with the name of the script`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`success`]);

            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                '[success] Tests executed correctly',
                '[success] Another line',
                `[failsafe] Script 'success' exited with code 0`,
                `[failsafe] Succeeded with exit code 0 as all scripts passed`,
            ].join('\n'));
        });

        it(`reports the stderr, prefixing each line with the name of the script`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`general-failure`]);

            expect(exitCode).to.equal(General_Failure, `Expected exit code of ${General_Failure}${ format(logger) }`);

            expect(logger.stderr()).to.include([
                `[general-failure] A test has failed`,
                `[general-failure] Another line describing the problem`,
            ].join('\n'));

            expect(logger.stdout()).to.include([
                `[failsafe] Script 'general-failure' exited with code 1`,
                `[failsafe] Failed with exit code 1 due to failing script: 'general-failure'`,
            ].join('\n'));
        });

        it(`works with buffered output`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`buffered-output`]);

            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                '[buffered-output] This is one line',
                '[buffered-output] This is another line',
                `[failsafe] Script 'buffered-output' exited with code 0`,
            ].join('\n'));
        });
    });

    describe(`Order of execution`, () => {
        it(`executes scripts in a sequence`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`general-failure`, `success`, `other-failure`]);

            expect(exitCode).to.equal(Other_Failure, `Expected exit code of ${Other_Failure}${ format(logger) }`);

            expect(logger.combined()).to.match(toRegex([
                /.+/,
                `[general-failure] A test has failed`,
                `[general-failure] Another line describing the problem`,
                `[failsafe] Script 'general-failure' exited with code 1`,
                /.+/,
                `[success] Tests executed correctly`,
                `[success] Another line`,
                `[failsafe] Script 'success' exited with code 0`,
                /.+/,
                `[other-failure] A script has failed`,
                `[failsafe] Script 'other-failure' exited with code 7`,
                `[failsafe] Failed with exit code 7 due to failing scripts: 'general-failure', 'other-failure'`,
            ]));
        });
    });

    describe(`Error handling`, () => {
        it(`advises the developer when requested script doesn't exist`, async () => {
            const { run, logger } = failsafe({ isTTY: false });

            const exitCode = await run([`non-existent`]);

            expect(exitCode).to.equal(General_Failure, `Expected exit code of ${General_Failure}${ format(logger) }`);

            expect(logger.stderr()).to.include('Missing script: "non-existent"');

            expect(logger.stdout()).to.include(`[failsafe] Script 'non-existent' exited with code 1`);
        });
    });

    describe('ANSI colour support', () => {
        it(`is enabled when the terminal is a TTY (supports colour output)`, async () => {
            const { run, logger } = failsafe({ isTTY: true });

            const exitCode = await run([`check-ansi-support`]);

            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include(`[check-ansi-support] Colors supported`);
        });

        it(`is enabled when FORCE_COLOR env variable is set to 1`, async () => {
            // see https://github.com/chalk/supports-color/pull/31
            const { run, logger } = failsafe({ isTTY: false }, { FORCE_COLOR: '1' });

            const exitCode = await run([`check-ansi-support`]);

            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include(`[check-ansi-support] Colors supported`);
        });

        it(`is disabled when FORCE_COLOR env variable is set to 0`, async () => {
            // see https://github.com/chalk/supports-color/pull/31
            const { run, logger } = failsafe({ isTTY: false }, { FORCE_COLOR: '0' });

            const exitCode = await run([`check-ansi-support`]);

            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include(`[check-ansi-support] Colors not supported`);
        });
    });

    describe('Pass arguments', () => {

        it(`fails on unknown arguments with 1 script`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, '--spec=spec/some.spec.ts']);
            expect(exitCode).to.equal(General_Failure, `Expected exit code of ${General_Failure}${ format(logger) }`);

            expect(logger.stderr()).to.include([
                `[failsafe] Error: Unrecognised arguments: --spec=spec/some.spec.ts`,
                `[failsafe] Notice: To configure your project to recognize them you might want`,
                `[failsafe]         to change your package.json scripts to something like:`,
                `[failsafe]             "scripts": {`,
                `[failsafe]                 "script": "failsafe print-args [--spec]",`,
                `[failsafe]             }`,
                `[failsafe]         For details see: `,
            ].join('\n'));
        });
        it(`fails on unknown arguments with 2 scripts `, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, `[--foo]`, `also-print-args[--bar]`, '--spec', 'spec/some.spec.ts']);
            expect(exitCode).to.equal(General_Failure, `Expected exit code of ${General_Failure}${ format(logger) }`);

            expect(logger.stderr()).to.include([
                `[failsafe] Error: Unrecognised arguments: --spec spec/some.spec.ts`,
                `[failsafe] Notice: To configure your project to recognize them you might want`,
                `[failsafe]         to change your package.json scripts to something like:`,
                `[failsafe]             "scripts": {`,
                `[failsafe]                 "script": "failsafe print-args [--foo] also-print-args [--bar,--spec]",`,
                `[failsafe]             }`,
                `[failsafe]         For details see: `,
            ].join('\n'));
        });

        it(`fails on unknown arguments with 3 scripts`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`clean`, `test`, `report`, '--spec=spec/some.spec.ts']);
            expect(exitCode).to.equal(General_Failure, `Expected exit code of ${General_Failure}${ format(logger) }`);

            expect(logger.stderr()).to.include([
                `[failsafe] Error: Unrecognised arguments: --spec=spec/some.spec.ts`,
                `[failsafe] Notice: To configure your project to recognize them you might want`,
                `[failsafe]         to change your package.json scripts to something like:`,
                `[failsafe]             "scripts": {`,
                `[failsafe]                 "script": "failsafe clean test [--spec] report",`,
                `[failsafe]             }`,
                `[failsafe]         For details see: `,
            ].join('\n'));
        });

        it(`fails on multiple unknown arguments`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, '--foo', 'foo', '--bar', 'bar']);
            expect(exitCode).to.equal(General_Failure, `Expected exit code of ${General_Failure}${ format(logger) }`);

            expect(logger.stderr()).to.include([
                `[failsafe] Error: Unrecognised arguments: --foo foo --bar bar`,
                `[failsafe] Notice: To configure your project to recognize them you might want`,
                `[failsafe]         to change your package.json scripts to something like:`,
                `[failsafe]             "scripts": {`,
                `[failsafe]                 "script": "failsafe print-args [--foo,--bar]",`,
                `[failsafe]             }`,
                `[failsafe]         For details see: `,
            ].join('\n'));
        });

        it(`fails on multiple unknown arguments which results in wildcard`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, '-v', 'foo', 'bar']);
            expect(exitCode).to.equal(General_Failure, `Expected exit code of ${General_Failure}${ format(logger) }`);

            expect(logger.stderr()).to.include([
                `[failsafe] Error: Unrecognised arguments: -v foo bar`,
                `[failsafe] Notice: To configure your project to recognize them you might want`,
                `[failsafe]         to change your package.json scripts to something like:`,
                `[failsafe]             "scripts": {`,
                `[failsafe]                 "script": "failsafe print-args [-v,...]",`,
                `[failsafe]             }`,
                `[failsafe]         For details see: `,
            ].join('\n'));
        });

        it(`fails on missing brackets`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, `[`, '--foo=bar']);
            expect(exitCode).to.equal(General_Failure, `Expected exit code of ${General_Failure}${ format(logger) }`);

            expect(logger.stderr()).to.include([
                `[failsafe] Error: Missing ']' at position 23:`,
                `[failsafe]   print-args [ --foo=bar`,
                `[failsafe]   ----------------------^`,
            ].join('\n'));
        });

        it(`fails on missing separator or end bracket`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, `[`, '--foo', '--bar', ']']);
            expect(exitCode).to.equal(General_Failure, `Expected exit code of ${General_Failure}${ format(logger) }`);

            expect(logger.stderr()).to.include([
                `[failsafe] Error: Unexpected '--bar', expected either ',' or ']' at position 19:`,
                `[failsafe]   print-args [ --foo --bar`,
                `[failsafe]   ------------------^`,
            ].join('\n'));
        });

        it(`fails on duplicate arguments`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, `[`, '--foo', ',', '--foo', ']']);
            expect(exitCode).to.equal(General_Failure, `Expected exit code of ${General_Failure}${ format(logger) }`);

            expect(logger.stderr()).to.include([
                `[failsafe] Error: Duplicate argument '--foo' at position 20:`,
                `[failsafe]   print-args [ --foo, --foo`,
                `[failsafe]   -------------------^`,
            ].join('\n'));
        });

        it(`passes specific arguments`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run(['print-args[--foo][--bar]', '--foo', '--bar']);
            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                `[print-args] Listing 2 arguments`,
                `[print-args] "--foo"`,
                `[print-args] "--bar"`,
                `[failsafe] Script 'print-args' exited with code 0`,
            ].join('\n'));
        });

        it(`passes all arguments`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, '[...]', '--foo=bar', '--bar=foo']);
            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                `[print-args] Listing 2 arguments`,
                `[print-args] "--foo=bar"`,
                `[print-args] "--bar=foo"`,
                `[failsafe] Script 'print-args' exited with code 0`,
            ].join('\n'));
        });

        it(`passes all arguments preserving whitespace`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, '[...]', '--', '  foo  ', '  bar  ']);
            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                `[print-args] Listing 2 arguments`,
                `[print-args] "  foo  "`,
                `[print-args] "  bar  "`,
                `[failsafe] Script 'print-args' exited with code 0`,
            ].join('\n'), logger.stdout());
        });

        it(`escapes unescaped double quotes in arguments`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, '[...]', '--', '  "foo"  ', '  "bar"  ']);
            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                `[print-args] Listing 2 arguments`,
                `[print-args] "  \\"foo\\"  "`,
                `[print-args] "  \\"bar\\"  "`,
                `[failsafe] Script 'print-args' exited with code 0`,
            ].join('\n'), logger.stdout());
        });

        it(`passes all arguments after separator`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, '[...]', '--', 'foo bar', 'baz']);
            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                `[print-args] Listing 2 arguments`,
                `[print-args] "foo bar"`,
                `[print-args] "baz"`,
                `[failsafe] Script 'print-args' exited with code 0`,
            ].join('\n'), logger.stdout());
        });

        it(`passes different arguments to specific scripts`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, '[--foo]', 'also-print-args', '[--bar]', '--foo=bar', '--bar=foo']);
            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                `[print-args] Listing 1 arguments`,
                `[print-args] "--foo=bar"`,
                `[failsafe] Script 'print-args' exited with code 0`,
            ].join('\n'));

            expect(logger.stdout()).to.include([
                `[also-print-args] Listing 1 arguments`,
                `[also-print-args] "--bar=foo"`,
                `[failsafe] Script 'also-print-args' exited with code 0`,
            ].join('\n'));
        });

        it(`passes specific argument to multiple scripts`, async () => {

            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, '[--foo]', 'also-print-args', '[--foo]', '--foo=bar']);
            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                `[print-args] Listing 1 arguments`,
                `[print-args] "--foo=bar"`,
                `[failsafe] Script 'print-args' exited with code 0`,
            ].join('\n'));

            expect(logger.stdout()).to.include([
                `[also-print-args] Listing 1 arguments`,
                `[also-print-args] "--foo=bar"`,
                `[failsafe] Script 'also-print-args' exited with code 0`,
            ].join('\n'));
        });

        it(`passes any argument to multiple scripts`, async () => {

            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, '[...]', 'also-print-args', '[...]', '--foo=bar', 'some/filename']);
            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                `[print-args] Listing 2 arguments`,
                `[print-args] "--foo=bar"`,
                `[print-args] "some/filename"`,
                `[failsafe] Script 'print-args' exited with code 0`,
            ].join('\n'));

            expect(logger.stdout()).to.include([
                `[also-print-args] Listing 2 arguments`,
                `[also-print-args] "--foo=bar"`,
                `[also-print-args] "some/filename"`,
                `[failsafe] Script 'also-print-args' exited with code 0`,
            ].join('\n'));
        });

        it(`passes multiple arguments to multiple scripts`, async () => {

            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, '[--foo,...]', 'also-print-args', '[--bar,...]', '--foo', '--bar', '--baz']);
            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                `[print-args] Listing 2 arguments`,
                `[print-args] "--foo"`,
                `[print-args] "--baz"`,
                `[failsafe] Script 'print-args' exited with code 0`,
            ].join('\n'));

            expect(logger.stdout()).to.include([
                `[also-print-args] Listing 2 arguments`,
                `[also-print-args] "--bar"`,
                `[also-print-args] "--baz"`,
                `[failsafe] Script 'also-print-args' exited with code 0`,
            ].join('\n'));
        });

    });
});

function failsafe(config: Partial<FailsafeConfig> = {}, env: typeof process.env = { }): { run: (scriptsName: string[]) => Promise<ExitCode>, logger: AccumulatingLogger } {
    const logger = new AccumulatingLogger();

    const failsafeInstance = new Failsafe(
        logger,
        {
            cwd: path.join(__dirname, `test-project`),
            isTTY: true,
            ... config,
        },
        {
            ...process.env,
            ...env,
        },
    );

    return { run: failsafeInstance.run.bind(failsafeInstance), logger };
}

function indented(text: string, indentation = 8): string {
    const space = ' '.repeat(indentation);

    return text.split('\n')
        .map(line => `${ space }${ line }`)
        .join('\n');
}

function format(logger: AccumulatingLogger): string {

    return `
        STDOUT:
${ indented(logger.stdout()) }
        
        STDERR:        
${ indented(logger.stderr()) }
    `;
}

class AccumulatingLogger extends Logger {
    constructor(
        public readonly allEntries: string[] = [],
        public readonly infoEntries: string[] = [],
        public readonly errorEntries: string[] = [],
    ) {
        super();
    }

    help(line: string): void {
        this.infoEntries.push(`${ line }`);
        this.allEntries.push(`${ line }`);
    }

    info(scriptName: string, line: string) {
        const lines = this.prefixed(scriptName, line).split('\n')
        this.infoEntries.push(...lines);
        this.allEntries.push(...lines);
    }

    error(scriptName: string, line: string) {
        const lines = this.prefixed(scriptName, line).split('\n')
        this.errorEntries.push(...lines);
        this.allEntries.push(...lines);
    }

    combined(): string {
        return this.allEntries.join('\n')
    }

    stdout(): string {
        return this.infoEntries.join('\n')
    }

    stderr(): string {
        return this.errorEntries.join('\n')
    }
}

function escapeRegExp(string_: string): string {
    return string_.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&');
}

function toRegex(lines: (string|RegExp)[]): RegExp {
    const lastIndex = lines.length - 1;
    return new RegExp(
        lines.map(
            (line, i) => (line instanceof RegExp
                ? line.source
                : escapeRegExp(line))
                + (i === lastIndex ? '\n?' : '\n') // optional newline at the end
        ).join(''),
        'sm' // s: dot matches newline, m: multiline, ^ and $ match start/end of line
    );
}
