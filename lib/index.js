"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var failsafe_1 = require("./failsafe");
var logger_1 = require("./logger");
function run(scripts) {
    if (!scripts.length) {
        // tslint:disable-next-line:no-console
        console.error("Please specify which npm scripts you'd like to run, for example:\n", "  npm failsafe start test");
    }
    var failsafe = new failsafe_1.Failsafe(new logger_1.ConsoleLogger(), {
        cwd: process.cwd(),
    });
    return failsafe.run(scripts.map(function (script) { return script.trim(); }));
}
exports.run = run;
//# sourceMappingURL=index.js.map