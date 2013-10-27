// Object that represents the screen in text mode.

define(function () {
    // Blink rate is 1/16 of VSYNC frequency, which was 60 Hz.
    var CURSOR_BLINK_PERIOD = 1000 / (60/16);

    // The $screen parameter must be a reference to a <pre> for the output.
    var Screen = function ($screen) {
        this.$screen = $screen;

        // Blink the cursor.
        var toggleCursor = function () {
            $(".cursor").toggleClass("off");
            setTimeout(toggleCursor, CURSOR_BLINK_PERIOD/2);
        };
        toggleCursor();
    };

    // Text mode commands.
    Screen.prototype.cls = function () {
        this.$screen.empty();
    };
    Screen.prototype.print = function (s) {
        this.removeCursor();
        this.$screen.append(s);
    };
    Screen.prototype.printBold = function (s) {
        this.removeCursor();
        this.$screen.append(
            $("<span>").addClass("bold").append(s));
    };
    Screen.prototype.newLine = function () {
        this.removeCursor();
        this.$screen.append("<br>");

        // Wait until the screen has laid itself out, then scroll to the bottom.
        var self = this;
        setTimeout(function () {
            // Scroll up.
            while (true) {
                // Find location of cursor (which we assume is the bottom of the text) and
                // bottom of the screen.
                var screenRect = self.$screen[0].getBoundingClientRect();
                var cursor = self.$screen.find(".cursor")[0];
                if (!cursor) {
                    break;
                }
                var cursorRect = self.$screen.find(".cursor")[0].getBoundingClientRect();

                // Scroll up if necessary.
                if (cursorRect.bottom > screenRect.bottom) {
                    // Remove first line.
                    var html = self.$screen.html();
                    var i = html.indexOf("<br>");
                    if (i >= 0) {
                        html = html.slice(i + 4);
                    } else {
                        // Shouldn't happen.
                        break;
                    }
                    self.$screen.html(html);
                } else {
                    break;
                }
            }
        }, 0);
    };
    Screen.prototype.removeLastChar = function () {
        // Remove the last character from the screen. For backspacing.
        this.removeCursor();

        // The last character might be bold. Get the last child element.
        var last = this.$screen.children(":last-child");

        // This is a hack, because the only time we use this function is when
        // we're at a prompt, and all characters are individually bolded. This
        // won't work more generally.
        last.remove();
    };
    Screen.prototype.removeCursor = function () {
        this.$screen.find(".cursor").remove();
    };
    Screen.prototype.addCursor = function () {
        this.removeCursor();

        var cursor = $("<span>").addClass("cursor").append("&nbsp;");
        this.$screen.append(cursor);
    };

    return Screen;
});
