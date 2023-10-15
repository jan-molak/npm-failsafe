# NPM Failsafe

[![npm version][npm-version-image]][npm-version-url]
[![build status][actions-image]][actions-url]
[![Coverage Status](https://coveralls.io/repos/github/jan-molak/npm-failsafe/badge.svg?branch=main)](https://coveralls.io/github/jan-molak/npm-failsafe?branch=main)
[![npm][npm-stats-image]][npm-stats-url]

[actions-image]: https://github.com/jan-molak/npm-failsafe/workflows/Main/badge.svg
[actions-url]: https://github.com/jan-molak/npm-failsafe/actions
[npm-stats-image]: https://img.shields.io/npm/dm/npm-failsafe.svg?style=flat
[npm-stats-url]: https://npm-stat.com/charts.html?package=npm-failsafe
[npm-version-image]: https://badge.fury.io/js/npm-failsafe.svg
[npm-version-url]: https://badge.fury.io/js/npm-failsafe

The `npm-failsafe` lets you execute a sequence of NPM scripts and return the correct exit code
should any of them fail.

## Installation

```
npm install --save-dev npm-failsafe
```

## Usage

Failsafe is a command line tool. To view the available options, run the following command in your terminal:
```
npx failsafe --help
```

## Configuration

You can use `failsafe` to run scripts defined in your `package.json` file.

### Configuring Failsafe in `package.json`

If your scripts require any arguments, those can be specified upfront in your `package.json` file.

For example, given the below `package.json` file:

```json
{
    "scripts": {
        "test": "jest",
        "test:coverage": "npm run test -- --coverage",
        "lint": "eslint 'src/*'",
        "start": "pm2 start server.js --port=3000",
        "ci": "failsafe start lint test:coverage"
    }
}
```

Running: `npm run ci` will execute:
- `npm run start`
- `npm run lint`
- `npm run test:coverage`, in that order

It will also return the highest exit code of all the executed scripts.

### Configuring Failsafe at runtime

If you need to pass arguments to your scripts at runtime, pass them to `failsafe` directly, and then Failsafe will pass them 
to your script as per the configuration in your `package.json` file.

For example, given the below `package.json` file:
```json
{
    "scripts": {
        "test:clean": "rimraf reports",
        "test:execute": "cucumber-js",
        "test:report": "serenity-bdd run",
        "test": "failsafe test:clean test:execute [--name,--tags] test:report"
    }
}
```

Running `npm test -- --name="Authentication"` will execute:
- `npm run test:clean`
- `npm run test:execute -- --name="Authentication"`, which in turn will execute `cucumber-js --name="Authentication"`
- `npm run test:report`

The same applies to `npm test -- --tags="@smoke"`, which will execute:
- `npm run test:clean`
- `npm run test:execute -- --tags="@smoke"`, which in turn will execute `cucumber-js --name="@smoke"`
- `npm run test:report`

### Using wildcards

To help you avoid configuration errors, Failsafe will complain if you try to execute a script that doesn't exist,
or use an argument that is not configured for a given script. 

However, you can configure Failsafe with a wildcard of `[...]`. This instructs Failsafe to pass any arguments
it receives to the script configured with the wildcard.


For example, given the below `package.json` file:
```json
{
    "scripts": {
        "test:clean": "rimraf reports",
        "test:execute": "cucumber-js",
        "test:report": "serenity-bdd run",
        "test": "failsafe test:clean test:execute [...] test:report"
    }
}
```

Running `npm test -- --name="Authentication"` or `npm test -- --tags="@smoke"` will instruct Failsafe to pass
those arguments to the `test:execute` script - the receiver of the wildcard.

## Motivation

Assume a `package.json` with the following scripts defined:

```js
"scripts": {
    "preintegration": "bin/start_the_server.sh",
    "integration": "bin/run_some_tests_that_require_the_server.sh",
    "cleanup": "bin/shutdown_the_server.sh"
}
```

In this example, we want to execute the `integration` script.
The script runs some integration tests against some server,
which means that we need to start the server up before the tests and shut it
down afterwards.

The server itself is started in the `preintegration` phase
(check out the node docs to learn more about the
[`pre-` and `post-` commands](https://docs.npmjs.com/misc/scripts)).

The question is: how do we shut it down?

We _could_ add the following `test` script to our `package.json`:
`"test": "integration && cleanup"`.

The problem with this is that because of how the `&&` operator works, the `cleanup` script
will only get executed when the `integration` script **succeeds**. This is no good because we need
to shut down the server even if the `integration` tests fail.

We could try to use the `||` operator instead, which executes the second script no matter the result
of the first one: `"test": "integration || cleanup"`.
However, the problem with this approach is that the **exit code** of the `"integration || cleanup"`
combo will always take the value of `0`, **incorrectly indicating that the `test` script has succeeded**.
This could for example cause a continuous integration server to publish
your project even if the tests have failed...

Enter `npm-failsafe`!

With `npm-failsafe` you can execute a sequence of arbitrary NPM scripts and return the correct exit code
should any of them fail:

```js
"scripts": {
     "preintegration": "bin/start_the_server.sh",
     "integration": "bin/run_some_tests_that_require_the_server.sh",
     "cleanup": "bin/shutdown_the_server.sh",

     "test": "failsafe integration cleanup"
}
```

## Your feedback matters!

Did you find this project useful? [Give it a star on github](https://github.com/jan-molak/npm-failsafe)! &#9733;

Found a bug? Raise [an issue](https://github.com/jan-molak/npm-failsafe/issues?state=open)
or submit a pull request.

Have feedback? Let me know on twitter: [@JanMolak](https://twitter.com/JanMolak)
