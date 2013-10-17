// A token filter that strips out comment tokens.

define(["Token"], function (Token) {
    var CommentStripper = function (lexer) {
        this.lexer = lexer;
    };

    // Returns the next token.
    CommentStripper.prototype.next = function () {
        while (true) {
            var token = this.lexer.next();
            if (token.tokenType != Token.COMMENT) {
                return token;
            }
        }
    };

    // Peeks at the next token.
    CommentStripper.prototype.peek = function () {
        while (true) {
            var token = this.lexer.peek();
            if (token.tokenType != Token.COMMENT) {
                return token;
            } else {
                // Skip the comment.
                this.lexer.next();
            }
        }
    };

    return CommentStripper;
});
