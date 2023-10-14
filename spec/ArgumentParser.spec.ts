import 'mocha';

import { given } from 'mocha-testdata';

import { ArgumentParser } from '../src/ArgumentParser';
import { expect } from './expect';

describe(`ArgumentParser`, function () {

    given([
        { args: [ 'print-args', '[--foo]', '[--bar]', '--foo', 'bar', '--bar', 'foo' ], },
        { args: [ 'print-args', '[--foo,--bar]', '--foo', 'bar', '--bar', 'foo' ], },
        { args: [ 'print-args[--foo,--bar]', '--foo', 'bar', '--bar', 'foo' ], },
        { args: [ 'print-args', '[', '...', ']', '--foo', 'bar', '--bar', 'foo' ], },
        { args: [ 'print-args', '[...]', '--foo', 'bar', '--bar', 'foo' ], },
        { args: [ 'print-args[...]', '--foo', 'bar', '--bar', 'foo' ], },
    ]).
    it(`should parse arguments when their value is separated using a space`, async ({ args }) => {
        const parser = new ArgumentParser();
        const scripts = parser.parse(args);

        expect(scripts).to.deep.equal([{ name: 'print-args', arguments: [ '--foo', 'bar', '--bar', 'foo' ] }]);
    });

    given([
        { args: [ 'print-args', '[--foo]', '[--bar]', '--foo=bar', '--bar=foo' ], },
        { args: [ 'print-args', '[--foo][--bar]', '--foo=bar', '--bar=foo' ], },
        { args: [ 'print-args[--foo][--bar]', '--foo=bar', '--bar=foo' ], },
        { args: [ 'print-args[--foo,--bar]', '--foo=bar', '--bar=foo' ], },
        { args: [ 'print-args', '[--foo,--bar]', '--foo=bar', '--bar=foo' ], },
        { args: [ 'print-args', '[', '--foo,', '--bar', ']', '--foo=bar', '--bar=foo' ], },
        { args: [ 'print-args', '[...]', '--foo=bar', '--bar=foo' ], },
        { args: [ 'print-args[...]', '--foo=bar', '--bar=foo' ], },
    ]).
    it(`should parse arguments when their value is separated using an equals sign`, async ({ args }) => {
        const parser = new ArgumentParser();
        const scripts = parser.parse(args);

        expect(scripts).to.deep.equal([{ name: 'print-args', arguments: [ '--foo=bar', '--bar=foo' ] }]);
    });

    describe('complains when', () => {

        given([
            { args: [ 'print-args', '[--foo]', '[--bar]', '--foo=bar', '--bar=foo', 'baz' ] },
            { args: [ 'print-args', '[--foo][--bar]', '--foo=bar', '--bar=foo', 'baz' ] },
            { args: [ 'print-args[--foo][--bar]', '--foo=bar', '--bar=foo', 'baz' ] },
            { args: [ 'print-args[--foo,--bar]', '--foo=bar', '--bar=foo', 'baz' ] },
            { args: [ 'print-args', '[--foo,--bar]', '--foo=bar', '--bar=foo', 'baz' ] },
            { args: [ 'print-args', '[', '--foo,', '--bar', ']', '--foo=bar', '--bar=foo', 'baz' ] },
        ]).
        it(`receives an unrecognised argument`, async ({ args }) => {
            const parser = new ArgumentParser();

            expect(() => parser.parse(args)).to.throw('Unrecognised arguments: baz');
        });

        given([
            { args: [ 'print-args', '[' ], },
            { args: [ 'print-args', '[', '--foo' ], },

        ]).
        it(`encounters a missing ']'`, async ({ args }) => {
            const parser = new ArgumentParser();

            expect(() => parser.parse(args)).to.throw(`Missing ']'`);
        });

        given([
            { args: [ 'print-args', '[', ']' ], },
            { args: [ 'print-args', '[]' ], },

        ]).
        it(`encounters a missing argument name`, async ({ args }) => {
            const parser = new ArgumentParser();

            expect(() => parser.parse(args)).to.throw(`Missing argument name`);
        });

        given([
            { args: [ '[' ], },
            { args: [ 'print-args', '[[' ], },
        ]).
        it(`encounters an unexpected '['`, async ({ args }) => {
            const parser = new ArgumentParser();

            expect(() => parser.parse(args)).to.throw(`Unexpected '['`);
        });

        given([
            { args: [ 'print-args', ']' ], },
            { args: [ 'print-args', ']]' ], },
        ]).
        it(`encounters an unexpected ']'`, async ({ args }) => {
            const parser = new ArgumentParser();

            expect(() => parser.parse(args)).to.throw(`Unexpected ']'`);
        });

        given([
            { args: [ 'print-args', ',' ], },
            { args: [ 'print-args', ',,' ], },
            { args: [ 'print-args', '[--foo]', ',' ], },
        ]).
        it(`encounters an unexpected ']'`, async ({ args }) => {
            const parser = new ArgumentParser();

            expect(() => parser.parse(args)).to.throw(`Unexpected ','`);
        });
    });
});
