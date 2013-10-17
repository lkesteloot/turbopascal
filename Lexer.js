// Lexer, returning tokens, including peeking.

define(["utils", "Token", "PascalError"], function (utils, Token, PascalError) {
    // Whether to print tokens as they're read.
    var PRINT_TOKENS = false;

    var Lexer = function (stream) {
        this.stream = stream;
        this.nextToken = null;
    };

    // All valid symbols.
    var SYMBOLS = ["<", "<>", "<<", ":", ":=", ">", ">>", "<=", ">=", "-", "+",
        "*", "/", ";", ",", "[", "]", "(", ")", "=", "^", "@", "(*"];

    // All reserved words.
    var RESERVED_WORDS = ["program", "var", "begin", "end", "type", "procedure", "function",
        "uses", "for", "while", "repeat", "do", "then", "if", "else", "to", "downto", "until",
        "array", "of", "not", "record", "or", "and", "div", "mod", "const", "exit"];
    var RESERVED_WORDS_MAP = {};
    for (var i = 0; i < RESERVED_WORDS.length; i++) {
        RESERVED_WORDS_MAP[RESERVED_WORDS[i]] = true;
    }
    var isReservedWord = function (value) {
        return RESERVED_WORDS_MAP.hasOwnProperty(value.toLowerCase());
    };

    // Returns the next token.
    Lexer.prototype.next = function () {
        var token = this.peek();

        // We've used up this token, force the next next() or peek() to fetch another.
        this.nextToken = null;

        return token;
    };

    // Peeks at the next token.
    Lexer.prototype.peek = function () {
        // Fetch another token if necessary.
        if (this.nextToken === null) {
            this.nextToken = this._fetchNextToken();
        }

        return this.nextToken;
    };

    // Always gets another token.
    Lexer.prototype._fetchNextToken = function () {
        var ch;
        var lineNumber;

        // Skip whitespace.
        do {
            // Keep this updated as we walk through the whitespace.
            lineNumber = this.stream.lineNumber;

            ch = this.stream.next();
            if (ch === -1) {
                return new Token(null, Token.EOF);
            }
        } while (utils.isWhitespace(ch));

        // Check each type of token.
        var token = this._pickLongestToken(ch, SYMBOLS);
        if (token !== null && token.isSymbol("(*")) {
            // Comment.

            // Keep reading until we get "*)".
            var value = "";
            while (true) {
                ch = this.stream.next();
                if (ch === -1) {
                    break;
                } else if (ch === "*" && this.stream.peek() === ")") {
                    // Skip ")".
                    this.stream.next();
                    break;
                }
                value += ch;
            }
            token = new Token(value, Token.COMMENT);
        }
        if (token === null && utils.isIdentifierStart(ch)) {
            // Keep adding more characters until we're not part of this token anymore.
            var value = "";
            while (true) {
                value += ch;
                ch = this.stream.peek();
                if (ch === -1 || !utils.isIdentifierPart(ch)) {
                    break;
                }
                this.stream.next();
            }
            var tokenType = isReservedWord(value) ? Token.RESERVED_WORD : Token.IDENTIFIER;
            token = new Token(value, tokenType);
        }
        if (token === null && (utils.isDigit(ch) || ch === ".")) {
            if (ch === ".") {
                // This could be a number, a dot, or two dots.
                var nextCh = this.stream.peek();
                if (nextCh === ".") {
                    // Two dots.
                    this.stream.next();
                    token = new Token("..", Token.SYMBOL);
                } else if (!utils.isDigit(nextCh)) {
                    // Single dot.
                    token = new Token(".", Token.SYMBOL);
                } else {
                    // It's a number, leave token null.
                }
            }
            if (token === null) {
                // Parse number. Keep adding more characters until we're not
                // part of this token anymore.
                var value = "";
                var sawDecimalPoint = ch === ".";
                while (true) {
                    value += ch;
                    ch = this.stream.peek();
                    if (ch === -1) {
                        break;
                    }
                    if (ch === ".") {
                        // This may be a decimal point, but it may be the start
                        // of a ".." symbol. Peek twice and push back.
                        this.stream.next();
                        var nextCh = this.stream.peek();
                        this.stream.pushBack(ch);
                        if (nextCh === ".") {
                            // Double dot, end of number.
                            break;
                        }

                        // Now see if this single point is part of us or a separate symbol.
                        if (sawDecimalPoint) {
                            break;
                        } else {
                            // Allow one decimal point.
                            sawDecimalPoint = true;
                        }
                    } else if (!utils.isDigit(ch)) {
                        break;
                    }
                    // XXX Need to parse scientific notation.
                    this.stream.next();
                }
                token = new Token(value, Token.NUMBER);
            }
        }
        if (token === null && ch === "{") {
            // Comment.

            // Skip opening brace.
            ch = this.stream.next();

            // Keep adding more characters until we're not part of this token anymore.
            var value = "";
            while (true) {
                value += ch;
                ch = this.stream.next();
                if (ch === -1 || ch === "}") {
                    break;
                }
            }
            token = new Token(value, Token.COMMENT);
        }
        if (token === null && ch === "'") {
            // String literal.

            // Skip opening quote.
            ch = this.stream.next();

            // Keep adding more characters until we're not part of this token anymore.
            var value = "";
            while (true) {
                value += ch;
                ch = this.stream.next();
                if (ch === "'") {
                    // Handle double quotes.
                    if (this.stream.peek() === "'") {
                        // Eat next quote. First one will be added at top of loop.
                        this.stream.next();
                    } else {
                        break;
                    }
                } else if (ch === -1) {
                    break;
                }
            }
            token = new Token(value, Token.STRING);
        }
        if (token === null) {
            // Unknown token.
            token = new Token(ch, Token.SYMBOL);
            token.lineNumber = lineNumber;
            throw new PascalError(token, "unknown symbol");
        }

        token.lineNumber = lineNumber;

        if (PRINT_TOKENS) {
            console.log("Fetched token \"" + token.value + "\" of type " +
                        token.tokenType + " on line " + token.lineNumber);
        }

        return token;
    };

    // Find the longest symbols in the specified list. Returns a Token or null.
    Lexer.prototype._pickLongestToken = function (ch, symbols) {
        var longestSymbol = null;
        var nextCh = this.stream.peek();
        var twoCh = nextCh === -1 ? ch : ch + nextCh;

        for (var i = 0; i < symbols.length; i++) {
            var symbol = symbols[i];

            if ((symbol.length === 1 && ch === symbol) ||
                (symbol.length === 2 && twoCh === symbol)) {

                if (longestSymbol === null || symbol.length > longestSymbol.length) {
                    longestSymbol = symbol;
                }
            }
        }

        if (longestSymbol == null) {
            return null;
        }

        if (longestSymbol.length === 2) {
            // Eat the second character.
            this.stream.next();
        }

        return new Token(longestSymbol, Token.SYMBOL);
    };

    return Lexer;
});
