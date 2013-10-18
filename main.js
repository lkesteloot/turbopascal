// Main program of IDE-based compiler.

'use strict';

require.config({
    urlArgs: "bust=" + (new Date()).getTime(),
    paths: {
        "jquery": "vendor/jquery-1.10.1.min",
        "underscore": "vendor/underscore-1.5.2.min"
    }
});

require(["jquery", "Screen", "Keyboard", "IDE"], function ($, Screen, Keyboard, IDE) {
    var $screen = $("#screen");
    var screen = new Screen($screen);
    var keyboard = new Keyboard();
    var ide = new IDE(screen, keyboard);
    ide.printMenu();
});
