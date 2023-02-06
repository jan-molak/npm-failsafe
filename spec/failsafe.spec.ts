import 'mocha';

import { given } from 'mocha-testdata';
import path = require('path');

import { Failsafe } from '../src/failsafe';
import { Logger } from '../src/logger';
import expect = require('./expect');

describe(`Failsafe`, function() {
    this.timeout(5000);

    const
        Success = 0,
        General_Failure = 1;

    let logger: AccumulatingLogger,
        failsafe: Failsafe;

    beforeEach(() => {
        logger = new AccumulatingLogger();
        failsafe = new Failsafe(
            logger,
            { cwd: path.join(__dirname, `test-project`) },
        );
    });

    describe(`Returns with an exit code of the executed script, when:`, () => {
        it(`finishes with a success`, () => {
            return expect(failsafe.run([`success`])).to.eventually.equal(Success);
        });

        it(`finishes with a general failure`, () => {
            return expect(failsafe.run([`general-failure`])).to.eventually.equal(General_Failure);
        });
    });

    given(
        { scripts: [`success`, `success`], expected_result: Success },
        { scripts: [`success`, `general-failure`], expected_result: General_Failure },
        { scripts: [`general-failure`, `general-failure`], expected_result: General_Failure },
        { scripts: [`general`, `success`], expected_result: General_Failure },
    ).it(`returns with the worst exit code encountered`, ({ scripts, expected_result }) => {
        return expect(failsafe.run(scripts)).to.eventually.equal(expected_result);
    });

    describe(`Logging`, () => {

        it(`reports the stdout, prefixing each line with the name of the script`, async () => {
            const exitCode = await failsafe.run([`success`]);

            expect(exitCode).to.equal(Success);

            expect(logger.infoOutput()).to.include([
                '[success] Tests executed correctly',
                '[success] Another line',
                `[failsafe] Script 'success' exited with code 0`,
            ].join('\n'));
        });

        it(`reports the stderr, prefixing each line with the name of the script`, async () => {
            const exitCode = await failsafe.run([`general-failure`]);

            expect(exitCode).to.equal(General_Failure);

            expect(logger.errorOutput()).to.include([
                `[general-failure] A test has failed`,
                `[general-failure] Another line describing the problem`,
            ].join('\n'));

            expect(logger.infoOutput()).to.include([
                `[failsafe] Script 'general-failure' exited with code 1`,
            ].join('\n'));
        });

        it(`works with buffered output`, async () => {
            const exitCode = await failsafe.run([`buffered-output`]);

            expect(exitCode).to.equal(Success);

            expect(logger.infoOutput()).to.include([
                '[buffered-output] This is one line',
                '[buffered-output] This is another line',
                `[failsafe] Script 'buffered-output' exited with code 0`,
            ].join('\n'));
        });
    });

    describe(`Order of execution`, () => {
        it(`executes scripts in a sequence`, async () => {
            const exitCode = await failsafe.run([`success`, `general-failure`]);

            expect(exitCode).to.equal(General_Failure);

            expect(logger.infoOutput()).to.include([
                '[success] Tests executed correctly',
                '[success] Another line',
                `[failsafe] Script 'success' exited with code 0`,
            ].join('\n'));
            expect(logger.errorOutput()).to.include([
                `[general-failure] A test has failed`,
                `[general-failure] Another line describing the problem`,
            ].join('\n'));

            expect(logger.infoOutput()).to.include([
                `[failsafe] Script 'general-failure' exited with code 1`,
            ].join('\n'));
        });
    });

    describe(`Error handling`, () => {
        it(`advises the developer when requested script doesn't exist`, async () => {
            const exitCode = await failsafe.run([`non-existent`]);

            expect(exitCode).to.equal(General_Failure);

            expect(logger.errorOutput()).to.include([
                `[non-existent] npm ERR! Missing script: "non-existent"`,
            ].join('\n'));

            expect(logger.infoOutput()).to.include([
                `[failsafe] Script 'non-existent' exited with code 1`,
            ].join('\n'));
        });
    });
});

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

    infoOutput(): string {
        return this.infoEntries.join('\n')
    }

    errorOutput(): string {
        return this.errorEntries.join('\n')
    }
}
