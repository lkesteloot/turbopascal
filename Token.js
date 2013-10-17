// Token, including a value and type.

define(function () {
    var Token = function (value, tokenType) {
        this.value = value;
        this.tokenType = tokenType;
        this.lineNumber = -1;
    };

    // Token types.
    Token.IDENTIFIER = 0;
    Token.NUMBER = 1;
    Token.SYMBOL = 2;
    Token.COMMENT = 3;
    Token.STRING = 4;
    Token.EOF = 5;
    Token.RESERVED_WORD = 6;

    // Returns whether this token is a reserved word, such as "for". These are
    // case-insensitive.
    Token.prototype.isReservedWord = function (reservedWord) {
        return this.tokenType === Token.RESERVED_WORD &&
            this.value.toLowerCase() === reservedWord.toLowerCase();
    }

    // Returns whether this token is equal to the specified token. The line
    // number is not taken into account; only the type and value.
    Token.prototype.isEqualTo = function (other) {
        return this.tokenType === other.tokenType && this.value === other.value;
    }

    // Returns whether this is the specified symbol.
    Token.prototype.isSymbol = function (symbol) {
        return this.tokenType === Token.SYMBOL && this.value === symbol;
    }

    return Token;
});
