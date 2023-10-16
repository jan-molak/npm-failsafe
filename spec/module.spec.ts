
import { expect, use } from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

import { Failsafe } from '../src/Failsafe';
import { run } from '../src/index';

use(sinonChai);

describe('module', () => {
    describe('run', () => {
        it('instantiates Failsafe and passes arguments', async function () {
            const failsafeStub = sinon.stub(Failsafe.prototype);
            failsafeStub.run.resolves(123);

            const number = await run(['some', 'arguments']);
            expect( number ).to.equal(123);

            expect( failsafeStub.run ).to.have.been.calledWith(['some', 'arguments']);
        });
    });
});