import { describe, it } from 'mocha';

import { trimmed } from '../../src/logger';
import { expect } from '../expect';

class Example {
    toString(): string {
        return 'example';
    }
}

describe ('`trimmed` tag function', () => {

    it('trims the leading and trailing whitespace', () => {
        expect(trimmed `  Hello world!  `).to.equal('Hello world!');
    });

    it('supports values that can be converted to string', () => {
        expect(trimmed `string: ${ 'hello' }, number: ${ 42 }, object: ${ new Example() }`)
            .to.equal('string: hello, number: 42, object: example');
    });

    it('leaves the space between the lines if required', () => {
        expect(trimmed `
            | Description:
            |   Executes a sequence of npm scripts and returns
            |   the correct exit code should any of them fail.
            |
            | Example:
            |   Suppose you have the following npm scripts defined:
        `).to.equal([
            'Description:',
            '  Executes a sequence of npm scripts and returns',
            '  the correct exit code should any of them fail.',
            '',
            'Example:',
            '  Suppose you have the following npm scripts defined:',
        ].join('\n'));
    });

    it('trims padded multi-line string', () => {
        expect(trimmed `
            | Description:
            |   Executes a sequence of npm scripts and returns
            |   the correct exit code should any of them fail.
        `).to.equal([
            'Description:',
            '  Executes a sequence of npm scripts and returns',
            '  the correct exit code should any of them fail.',
        ].join('\n'));
    });
});
