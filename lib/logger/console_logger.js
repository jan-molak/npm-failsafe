"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ConsoleLogger = /** @class */ (function () {
    function ConsoleLogger() {
    }
    ConsoleLogger.prototype.info = function (script_name, message) {
        // tslint:disable-next-line:no-console
        console.info("[" + script_name + "] " + message);
    };
    ConsoleLogger.prototype.error = function (script_name, message) {
        // tslint:disable-next-line:no-console
        console.error("[" + script_name + "] " + message);
    };
    return ConsoleLogger;
}());
exports.ConsoleLogger = ConsoleLogger;
//# sourceMappingURL=console_logger.js.map