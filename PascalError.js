// Exception for parse, compile, and runtime errors.

define(function () {
    var PascalError = function (token, message) {
        this.token = token;
        this.message = message;

        // Grab a stack trace.
        this.stack = new Error().stack;
    };

    PascalError.prototype.getMessage = function () {
        var message = "Error: " + this.message;

        // Add token info.
        if (this.token) {
            message += " (\"" + this.token.value + "\", line " + this.token.lineNumber + ")";
        }

        return message;
    };

    return PascalError;
});
