import { expect, use } from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

import { ConsoleLogger } from '../../src/logger';

use(sinonChai)

describe('ConsoleLogger', () => {

    describe('help', () => {
        it('logs the line via console.log without any prefix', function () {
            const stub = sinon.stub(console, 'log');

            const logger = new ConsoleLogger()
            logger.help('hello world');

            expect( stub ).to.be.calledOnce;
            expect( stub ).to.be.calledWith('hello world');
        });
    });

    describe('info', () => {
        it('logs the line via console.info with prefix', function () {
            const stub = sinon.stub(console, 'info');

            const logger = new ConsoleLogger()
            logger.info('script-name', 'hello world');

            expect( stub ).to.be.calledOnce;
            expect( stub ).to.be.calledWith('[script-name] hello world');
        });
    });

    describe('error', () => {
        it('logs the line via console.error with prefix', function () {
            const stub = sinon.stub(console, 'error');

            const logger = new ConsoleLogger()
            logger.error('script-name', 'hello world');

            expect( stub ).to.be.calledOnce;
            expect( stub ).to.be.calledWith('[script-name] hello world');
        });
    });
})