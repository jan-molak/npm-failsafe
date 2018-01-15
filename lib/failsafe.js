"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var child_process_1 = require("child_process");
var readline = require("readline");
var Failsafe = /** @class */ (function () {
    function Failsafe(logger, config) {
        this.logger = logger;
        this.config = config;
    }
    Failsafe.prototype.run = function (scripts_names) {
        var _this = this;
        return scripts_names.reduce(function (previous, script_name) {
            return previous
                .then(function (previous_exit_code) { return _this.runScript(script_name)
                .then(function (current_exit_code) { return Math.max(previous_exit_code, current_exit_code); }); });
        }, Promise.resolve(0));
    };
    Failsafe.prototype.runScript = function (script_name) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var script = child_process_1.spawn("npm", ["run", script_name], {
                cwd: _this.config.cwd,
                env: process.env,
            });
            var stdout = readline.createInterface({ input: script.stdout }), stderr = readline.createInterface({ input: script.stderr });
            stdout
                .on('line', function (line) { return _this.logger.info(script_name, line); });
            stderr
                .on('line', function (line) { return _this.logger.error(script_name, line); });
            script.on('close', function (code) {
                stdout.close();
                stderr.close();
                _this.logger.info('failsafe', "Script '" + script_name + "' exited with code " + code);
                resolve(code);
            });
        });
    };
    return Failsafe;
}());
exports.Failsafe = Failsafe;
//# sourceMappingURL=failsafe.js.map