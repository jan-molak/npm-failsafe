import 'mocha';
import { given } from 'mocha-testdata';

import path = require('path');
import expect = require('./expect');
import { Failsafe } from '../src/failsafe';
import { Logger } from '../src/logger';

describe(`Failsafe`, function() {
    this.timeout(5000);
    
    const 
        Success = 0,
        General_Failure = 1,
        Fatal_Error = 10;

    let logger: AccumulatingLogger,
        failsafe: Failsafe;

    beforeEach(() => {
        logger = new AccumulatingLogger();
        failsafe = new Failsafe(
            logger,
            {cwd: path.join(__dirname, `test-project`)}
        );
    });

    describe(`Returns with an exit code of the executed script, when:`, () => {
        it(`finishes with a success`, () => {
            return expect(failsafe.run([`success`])).to.eventually.equal(Success);
        });

        it(`finishes with a general failure`, () => {
            return expect(failsafe.run([`general-failure`])).to.eventually.equal(General_Failure);
        });

        it(`finishes with a fatal error`, () => {
            return expect(failsafe.run([`fatal-error`])).to.eventually.equal(Fatal_Error);
        });
    });

    given(
        {scripts: [`success`, `success`], expected_result: Success },
        {scripts: [`success`, `general-failure`], expected_result: General_Failure },
        {scripts: [`general-failure`, `fatal-error`], expected_result: Fatal_Error },
        {scripts: [`fatal-error`, `fatal-error`], expected_result: Fatal_Error },
        {scripts: [`fatal-error`, `general-failure`, `success`], expected_result: Fatal_Error },
    ).it(`returns with the worst exit code encountered`, ({ scripts, expected_result }) => {
        return expect(failsafe.run(scripts)).to.eventually.equal(expected_result);
    });

    describe(`Logging`, () => {

        it(`reports the stdout, prefixing each line with the name of the script`, () => {
            return failsafe.run([`success`]).then(_ => {
               expect(line(4, 6).of(logger.info_entries)).to.deep.equal([
                   '[success] Tests executed correctly',
                   '[success] Another line',
                   `[failsafe] Script 'success' exited with code 0`,
               ]);
            });
        });

        it(`reports the stderr, prefixing each line with the name of the script`, () => {
            return failsafe.run([`general-failure`]).then(_ => {
                expect(line(0, 1).of(logger.error_entries)).to.deep.equal([
                    `[general-failure] A test has failed`,
                    `[general-failure] Another line describing the problem`,
                ]);
                expect(line(4).of(logger.info_entries)).to.deep.equal([
                    `[failsafe] Script 'general-failure' exited with code 1`,
                ]);
            });
        });

        it(`works with buffered output`, () => {
            return failsafe.run([`buffered-output`]).then(_ => {
                expect(line(4, 6).of(logger.info_entries)).to.deep.equal([
                    '[buffered-output] This is one line',
                    '[buffered-output] This is another line',
                    `[failsafe] Script 'buffered-output' exited with code 0`,
                ]);
            });
        });
    });

    describe(`Order of execution`, () => {
        it(`executes scripts in a sequence`, () => {
            return failsafe.run([`success`, `general-failure`]).then(_ => {
                expect(line(4, 6).of(logger.info_entries)).to.deep.equal([
                    '[success] Tests executed correctly',
                    '[success] Another line',
                    `[failsafe] Script 'success' exited with code 0`,
                ]);
                expect(line(0, 1).of(logger.error_entries)).to.deep.equal([
                    `[general-failure] A test has failed`,
                    `[general-failure] Another line describing the problem`,
                ]);
                expect(line(11, 14).of(logger.info_entries)).to.deep.equal([
                    `[failsafe] Script 'general-failure' exited with code 1`,
                ]);
            });
        });
    });

    describe(`Error handling`, () => {
        it(`advises the developer when requested script doesn't exist`, () => {
            return expect(failsafe.run([`non-existent`])).to.eventually.equal(General_Failure)
                .then(_ => {
                    expect(line(0).of(logger.error_entries)).to.deep.equal([
                        `[non-existent] npm ERR! missing script: non-existent`,
                        `[non-existent] `,
                    ]);
                    expect(line(0, 3).of(logger.info_entries)).to.deep.equal([
                        `[failsafe] Script 'non-existent' exited with code 1`
                    ])
                });
        });
    });
});

function line(start: number, end: number = start + 1) {
    return ({
        of: (output: string[]) => output.slice(start, end + 1),
    })
}

class AccumulatingLogger implements Logger {
    constructor(public readonly info_entries: string[] = [],
                public readonly error_entries: string[] = [],) {
    }

    info(script_name: string, line: string) {
        this.info_entries.push(`[${script_name}] ${line}`);
    }

    error(script_name: string, line: string) {
        this.error_entries.push(`[${script_name}] ${line}`);
    }
}
