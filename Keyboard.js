// Object to interface with the keyboard.

define(["jquery"], function ($) {
    var Keyboard = function () {
        // Listener for new keys in the queue.
        this.listener = null;

        // Queue of characters waiting to be read. The most recent character is last.
        this.queue = [];

        // Register for keystrokes anywhere in the page.
        var self = this;
        $("body").keydown(function (event) {
            self._keyEvent(event, true);
        }).keyup(function (event) {
            self._keyEvent(event, false);
        });
    };

    // Register a listener to be called when a key is pressed. The listener
    // is passed nothing -- it must use readKey() to get the key.
    Keyboard.prototype.setListener = function (listener) {
        this.listener = listener;
    };

    // This function simulates the KeyPressed function in Turbo Pascal. It
    // returns true if there are keys waiting to be consumed.
    Keyboard.prototype.keyPressed = function () {
        return this.queue.length > 0;
    };

    // This function simulates the ReadKey function in Turbo Pascal. It
    // returns (and removes) the oldest key in the queue. It should block
    // if the queue is empty, but we don't implement this.
    Keyboard.prototype.readKey = function () {
        if (this.queue.length > 0) {
            return this.queue.shift();
        } else {
            return 0;
        }
    };

    // Handle a raw key event.
    Keyboard.prototype._keyEvent = function (event, isPressed) {
        var key = this._eventToKey(event);
        if (key !== "" && isPressed) {
            this._dispatchKey(key);
        }
    };

    // Dispatch a key to listener.
    Keyboard.prototype._dispatchKey = function (ch) {
        if (typeof ch === "string") {
            // Enqueue single key.
            this.queue.push(ch);
        } else if (ch.length > 0) {
            // Enqueue all keys (extended keys).
            for (var i = 0; i < ch.length; i++) {
                this.queue.push(ch[i]);
            }
        }

        // Tell the listener that there's now something in the queue.
        if (this.listener) {
            this.listener();
        }
    };

    // Converts a keydown/keyup event to a key.
    Keyboard.prototype._eventToKey = function (event) {
        var key;
        var which = event.which;
        var shifted = event.shiftKey;

        // See Appendix K of the Turbo Pascal 3.0 manual or Appendix E of the
        // Turbo Pascal 4.0 manual. In version 3.0 they used #27 (ESC) as a prefix
        // for extended codes, but in 4.0 they moved to #0 for the prefix. This
        // program is trying to emulate version 3.0, but my code all expects
        // #0, so that's what I'm using here.
        var prefix = "\0";

        if (which === 13) {
            // Enter.
            key = "\r";
        } else if (which === 32) {
            // Space.
            key = " ";
        } else if (which >= 65 && which < 65+26) {
            // Letters.
            if (!shifted) {
                // Make lower case.
                which += 32;
            }
            key = String.fromCharCode(which);
        } else if (which === 48) {
            key = shifted ? ")" : "0";
        } else if (which === 49) {
            key = shifted ? "!" : "1";
        } else if (which === 50) {
            key = shifted ? "@" : "2";
        } else if (which === 51) {
            key = shifted ? "#" : "3";
        } else if (which === 52) {
            key = shifted ? "$" : "4";
        } else if (which === 53) {
            key = shifted ? "%" : "5";
        } else if (which === 54) {
            key = shifted ? "^" : "6";
        } else if (which === 55) {
            key = shifted ? "&" : "7";
        } else if (which === 56) {
            key = shifted ? "*" : "8";
        } else if (which === 57) {
            key = shifted ? "(" : "9";
        } else if (which === 8) {
            // Backspace.
            key = String.fromCharCode(which);

            // Don't go back to previous page.
            event.preventDefault();
        } else if (which === 187) {
            // Equal.
            key = shifted ? "+" : "=";
        } else if (which === 188) {
            // Comma.
            key = shifted ? "<" : ",";
        } else if (which === 190) {
            // Period.
            key = shifted ? ">" : ".";
        } else if (which == 16) {
            // Shift, ignore.
            key = "";
        } else if (which == 192) {
            // Backtick.
            key = shifted ? "~" : "`";
        } else if (which == 186) {
            // Semicolon.
            key = shifted ? ":" : ";";
        } else if (which == 222) {
            // Quote..
            key = shifted ? "\"" : "'";
        } else if (which == 189) {
            // Hyphen.
            key = shifted ? "_" : "-";
        } else if (which == 191) {
            // Slash.
            key = shifted ? "?" : "/";
        } else if (which == 37) {
            // Left arrow.
            key = [prefix, String.fromCharCode(75)];
        } else if (which == 39) {
            // Right arrow.
            key = [prefix, String.fromCharCode(77)];
        } else if (which == 40) {
            // Down arrow.
            key = [prefix, String.fromCharCode(80)];
        } else if (which == 38) {
            // Up arrow.
            key = [prefix, String.fromCharCode(72)];
        } else if (which == 27) {
            // Escape.
            key = String.fromCharCode(which);
        } else if (which == 9) {
            // Tab.
            key = String.fromCharCode(which);

            // Don't move focus to next field.
            event.preventDefault();
        } else {
            // Ignore.
            key = "";
        }

        return key;
    };

    return Keyboard;
});
