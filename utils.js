// Utility functions.

define({
    // Whether the character is alphabetic.
    isAlpha: function (ch) {
        return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
    },

    // Whether the character is a digit.
    isDigit: function (ch) {
        return ch >= '0' && ch <= '9';
    },

    // Whether the character is a valid first character of an identifier.
    isIdentifierStart: function (ch) {
        return this.isAlpha(ch) || ch == '_';
    },

    // Whether the character is a valid subsequent (non-first) character of an identifier.
    isIdentifierPart: function (ch) {
        return this.isIdentifierStart(ch) || this.isDigit(ch);
    },

    // Whether the character is whitespace.
    isWhitespace: function (ch) {
        return ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r';
    },

    // Format number or string to width characters, left-aligned.
    leftAlign: function (value, width) {
        // Convert to string.
        value = "" + value;

        // Pad to width.
        while (value.length < width) {
            value = value + " ";
        }

        return value;
    },

    // Format number or string to width characters, right-aligned.
    rightAlign: function (value, width) {
        // Convert to string.
        value = "" + value;

        // Pad to width.
        while (value.length < width) {
            value = " " + value;
        }

        return value;
    },

    // Truncate toward zero.
    trunc: function (value) {
        if (value < 0) {
            return Math.ceil(value);
        } else {
            return Math.floor(value);
        }
    },

    // Repeat a string "count" times.
    repeatString: function (s, count) {
        var result = "";

        // We go through each bit of "count", adding a string of the right length
        // to "result" if the bit is 1.
        while (true) {
            if ((count & 1) !== 0) {
                result += s;
            }

            // Move to the next bit.
            count >>= 1;
            if (count === 0) {
                // Exit here before needlessly doubling the size of "s".
                break;
            }

            // Double the length of "s" to correspond to the value of the shifted bit.
            s += s;
        }

        return result;
    },

    // Log an object written out in human-readable JSON. This can't handle
    // circular structures.
    logAsJson: function (obj) {
        console.log(JSON.stringify(obj, null, 2));
    }
});
