// Unit tests for the compiler. Run by loading unit.html.

'use strict';

require.config({
    /// urlArgs: "bust=" + (new Date()).getTime(),
    paths: {
        "jquery": "vendor/jquery-1.10.1.min",
        "underscore": "vendor/underscore-1.5.2.min"
    }
});

require(["jquery", "Stream", "Token", "Lexer", "CommentStripper", "Parser",
        "PascalError", "Compiler", "Machine", "SymbolTable"],
        function ($, Stream, Token, Lexer, CommentStripper,
                  Parser, PascalError, Compiler, Machine, SymbolTable) {

    var $results = $("#results tbody");
    var generateResult = function (name, passed, reason) {
        $results.append($("<tr>").
                        append($("<td>").text(name)).
                        append($("<td>").append(
                            $("<span>").text(passed ? "passed" : "failed").
                                addClass(passed ? "passed" : "failure"))).
                        append($("<td>").text(reason)));
    };

    $('script[type="text/pascal"]').each(function () {
        var $test = $(this);
        var name = $test.attr("id");
        var source = $test.text();
        var stream = new Stream(source);
        var lexer = new CommentStripper(new Lexer(stream));
        var parser = new Parser(lexer);
        var output = "";

        try {
            // Create the symbol table of built-in constants, functions, and procedures.
            var builtinSymbolTable = SymbolTable.makeBuiltinSymbolTable();

            // Parse the program into a parse tree. Create the symbol table as we go.
            var root = parser.parse(builtinSymbolTable);

            // Compile to bytecode.
            var compiler = new Compiler();
            var bytecode = compiler.compile(root);

            // Execute the bytecode.
            var machine = new Machine(bytecode);
            machine.setFinishCallback(function (runningTime) {
                var expected = $.trim($test.data("expected"));
                output = $.trim(output);
                if (output === expected) {
                    generateResult(name, true, "");
                } else {
                    generateResult(name, false, "expected \"" +
                                   expected + "\" but got \"" + output + "\"");
                }
            });
            machine.setOutputCallback(function (line) {
                output += line + " ";
            });
            machine.run();
        } catch (e) {
            // Print parsing errors.
            var message;
            if (e instanceof PascalError) {
                console.log(name + ": " + e.getMessage());
                message = e.getMessage();
            } else {
                message = "Got JavaScript exception";
            }
            console.log(name + ": " + e.stack);
            generateResult(name, false, message);
        }
    });
});
