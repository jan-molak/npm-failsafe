import 'mocha';

import { given } from 'mocha-testdata';
import path = require('path');

import { ExitCode, Failsafe, FailsafeConfig } from '../src/Failsafe';
import { Logger } from '../src/logger';

import expect = require('./expect');

describe(`Failsafe`, function() {
    this.timeout(5000);

    const
        Success = 0,
        General_Failure = 1;

    it(`exits with error when no scripts are specified`, async () => {
        const { run, logger } = failsafe();

        const exitCode = await run([]);

        expect(exitCode).to.equal(General_Failure);

        expect(logger.stderr()).to.include([
            `[failsafe] Please specify which npm scripts you'd like to run, for example:`,
            `  npm failsafe start test`,
        ].join('\n'));
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
        { scripts: [`general`, `success`], expected_result: General_Failure },
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

            const exitCode = await run([`success`, `general-failure`]);

            expect(exitCode).to.equal(General_Failure, `Expected exit code of ${General_Failure}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                '[success] Tests executed correctly',
                '[success] Another line',
                `[failsafe] Script 'success' exited with code 0`,
            ].join('\n'));

            expect(logger.stderr()).to.include([
                `[general-failure] A test has failed`,
                `[general-failure] Another line describing the problem`,
            ].join('\n'));

            expect(logger.stdout()).to.include([
                `[failsafe] Script 'general-failure' exited with code 1`,
            ].join('\n'));
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

        it(`fails on unknown arguments`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, '--foo=bar', '--bar=foo']);
            expect(exitCode).to.equal(General_Failure, `Expected exit code of ${General_Failure}${ format(logger) }`);

            expect(logger.stderr()).to.include(`Unknown argument '--foo=bar'`);
        });

        it(`passes specific arguments`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, '[--foo]', '--foo=bar']);
            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                `[print-args] Listing 1 arguments`,
                `[print-args] --foo=bar`,
                `[failsafe] Script 'print-args' exited with code 0`,
            ].join('\n'));
        });

        it(`passes specific arguments interleaved`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run(['print-args[--foo][--bar]', '--foo', '--bar']);
            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                `[print-args] Listing 2 arguments`,
                `[print-args] --foo`,
                `[print-args] --bar`,
                `[failsafe] Script 'print-args' exited with code 0`,
            ].join('\n'));
        });

        it(`passes all arguments`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, '[...]', '--foo=bar', '--bar=foo']);
            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                `[print-args] Listing 2 arguments`,
                `[print-args] --foo=bar`,
                `[print-args] --bar=foo`,
                `[failsafe] Script 'print-args' exited with code 0`,
            ].join('\n'));
        });

        it(`passes all arguments interleaved`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args[...]`, '--foo=bar', '--bar=foo']);
            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                `[print-args] Listing 2 arguments`,
                `[print-args] --foo=bar`,
                `[print-args] --bar=foo`,
                `[failsafe] Script 'print-args' exited with code 0`,
            ].join('\n'));
        });

        it(`passes all arguments after separator`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, '[...]', '--', 'foo bar', 'baz']);
            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                `[print-args] Listing 2 arguments`,
                `[print-args] foo bar`,
                `[print-args] baz`,
                `[failsafe] Script 'print-args' exited with code 0`,
            ].join('\n'));
        });

        it(`passes different arguments to specifc scripts`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run([`print-args`, '[--foo]', 'also-print-args', '[--bar]', '--foo=bar', '--bar=foo']);
            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                `[print-args] Listing 1 arguments`,
                `[print-args] --foo=bar`,
                `[failsafe] Script 'print-args' exited with code 0`,
            ].join('\n'));

            expect(logger.stdout()).to.include([
                `[also-print-args] Listing 1 arguments`,
                `[also-print-args] --bar=foo`,
                `[failsafe] Script 'also-print-args' exited with code 0`,
            ].join('\n'));
        });

        it(`passes different arguments to specifc scripts interleaved`, async () => {
            const { run, logger } = failsafe();

            const exitCode = await run(['print-args[--foo]', 'also-print-args[--bar]', '--foo=bar', '--bar=foo']);
            expect(exitCode).to.equal(Success, `Expected exit code of ${Success}${ format(logger) }`);

            expect(logger.stdout()).to.include([
                `[print-args] Listing 1 arguments`,
                `[print-args] --foo=bar`,
                `[failsafe] Script 'print-args' exited with code 0`,
            ].join('\n'));

            expect(logger.stdout()).to.include([
                `[also-print-args] Listing 1 arguments`,
                `[also-print-args] --bar=foo`,
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

class AccumulatingLogger implements Logger {
    constructor(
        public readonly infoEntries: string[] = [],
        public readonly errorEntries: string[] = [],
    ) {
    }

    info(script_name: string, line: string) {
        this.infoEntries.push(`[${ script_name }] ${ line }`);
    }

    error(script_name: string, line: string) {
        this.errorEntries.push(`[${ script_name }] ${ line }`);
    }

    stdout(): string {
        return this.infoEntries.join('\n')
    }

    stderr(): string {
        return this.errorEntries.join('\n')
    }
}
