// Character streamer. Streams characters from the input (a string) one at a
// time, including peeking. Returns -1 on end of file.

define(function () {
    var Stream = function (input) {
        this.input = input;
        this.position = 0;
        this.lineNumber = 1;
    };

    // Returns the next character, or -1 on end of file.
    Stream.prototype.next = function () {
        var ch = this.peek();
        if (ch == "\n") {
            this.lineNumber++;
        }
        if (ch != -1) {
            this.position++;
        }
        return ch;
    };

    // Peeks at the next character, or -1 on end of file.
    Stream.prototype.peek = function () {
        if (this.position >= this.input.length) {
            return -1;
        }
        return this.input[this.position];
    };

    // Inverse of "next()" method.
    Stream.prototype.pushBack = function (ch) {
        if (this.position === 0) {
            throw new "Can't push back at start of stream";
        }
        this.position--;
        // Sanity check.
        if (this.input[this.position] != ch) {
            throw new "Pushed back character doesn't match";
        }
    };

    return Stream;
});
