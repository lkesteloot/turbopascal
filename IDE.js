// Interactive Development Environment, based on Turbo Pascal 3.0.

define(["Stream", "Token", "Lexer", "CommentStripper", "Parser",
        "PascalError", "Compiler", "Machine", "SymbolTable", "utils", "jquery"],
        function (Stream, Token, Lexer, CommentStripper,
                  Parser, PascalError, Compiler, Machine, SymbolTable, utils, $) {

    // Available source files.
    var FILES = [
        // "TEST.PAS",
        "FIREWORK.PAS",
        "FASTMAND.PAS",
        "SPIDER.PAS",
        "BSPLINE.PAS",
        "ROSE.PAS",
        "HELLO.PAS"
    ];
    FILES.sort();

    // Input modes. This determines what happens to keyboard input.
    var INPUT_MENU = 0;
    var INPUT_STRING = 1;
    var INPUT_RUNNING = 2;
    var INPUT_EDITOR = 3;

    var IDE = function (screen, keyboard) {
        this.screen = screen;
        this.keyboard = keyboard;

        // The file being edited/run.
        this.workFile = "";

        // Where keyboard input goes.
        this.inputMode = INPUT_MENU;

        // Function to call when input is done (for INPUT_STRING).
        this.inputCallback = null;

        // Input string being accumulated (for INPUT_STRING).
        this.inputString = "";

        // The actual text of the program in memory.
        this.source = "";

        // Shut down the editor when the user clicks on the "Close editor" link.
        var self = this;
        $("#closeEditor").click(function (event) {
            event.preventDefault();
            self._closeEditor();
        });

        this.keyboard.setListener(function () {
            if (self.inputMode === INPUT_RUNNING) {
                // If we're running a program, do nothing, the program will read the keys
                // out of the queue.
            } else {
                // Only read a key if one's available (which it should be if we're here).
                while (keyboard.keyPressed()) {
                    // Pull the key out of the queue.
                    var ch = keyboard.readKey();

                    // Only dispatch keys if we're in the IDE proper.
                    if (self.inputMode === INPUT_MENU || self.inputMode === INPUT_STRING) {
                        self._gotKey(ch);
                    }
                }
            }
        });
    };

    // Clear the screen and show the main menu.
    IDE.prototype.printMenu = function () {
        var drive = "C";
        var directory = "\\TURBO";
        var workPath = this.workFile === "" ? "" : (drive + ":" + directory + "\\" + this.workFile);

        this.screen.cls();

        this.screen.printBold("L");
        this.screen.print("ogged drive: ");
        this.screen.printBold(drive);
        this.screen.newLine();

        this.screen.printBold("A");
        this.screen.print("ctive directory: ");
        this.screen.printBold(directory);
        this.screen.newLine();

        this.screen.newLine();

        this.screen.printBold("W");
        this.screen.print("ork file: ");
        this.screen.printBold(workPath);
        this.screen.newLine();

        this.screen.printBold("M");
        this.screen.print("ain file: ");
        this.screen.printBold("");
        this.screen.newLine();

        this.screen.newLine();

        this.screen.printBold("E");
        this.screen.print("dit     ");
        this.screen.printBold("C");
        this.screen.print("ompile  ");
        this.screen.printBold("R");
        this.screen.print("un   ");
        this.screen.printBold("S");
        this.screen.print("ave");
        this.screen.newLine();

        this.screen.newLine();

        this.screen.printBold("D");
        this.screen.print("ir      ");
        this.screen.printBold("Q");
        this.screen.print("uit  compiler ");
        this.screen.printBold("O");
        this.screen.print("ptions  ");
        this.screen.newLine();

        this.screen.newLine();

        this.screen.print("Text: " + this.source.length + " bytes");
        this.screen.newLine();

        this.screen.print("Free: " + (62932 - this.source.length) + " bytes");
        this.screen.newLine();

        this.printPrompt();
    };

    // Set the input mode (where the keyboard goes to).
    IDE.prototype._setInputMode = function (inputMode, inputCallback) {
        this.inputMode = inputMode;
        this.inputString = "";
        this.inputCallback = inputCallback;

        // Suppress it if we're not in the editor.
        this.keyboard.setSuppressKeys(inputMode !== INPUT_EDITOR);

        // Show "Close editor" if we're editing.
        $("#closeEditor").toggle(inputMode === INPUT_EDITOR);
    };

    // Print the menu prompt.
    IDE.prototype.printPrompt = function () {
        this.screen.newLine();
        this.screen.printBold(">");
        this.screen.addCursor();
        this._setInputMode(INPUT_MENU);
    };

    // Received a key from the keyboard.
    IDE.prototype._gotKey = function (ch) {
        switch (this.inputMode) {
            case INPUT_MENU:
                // Commands are all upper case.
                ch = ch.toUpperCase();

                if (ch >= "A" && ch <= "Z") {
                    this._interpretCommand(ch);
                } else {
                    this.printMenu();
                }
                break;

            case INPUT_STRING:
                // Accumulate a string.
                if (ch === "\n" || ch === "\r") {
                    this.screen.newLine();
                    if (this.inputCallback) {
                        this.inputCallback(this.inputString);
                    }
                } else {
                    if (ch === "\b") {
                        // Backspace.
                        if (this.inputString.length > 0) {
                            this.inputString = this.inputString.slice(
                                0, this.inputString.length - 1);
                            this.screen.removeLastChar();
                        }
                    } else {
                        this.screen.printBold(ch);
                        this.inputString += ch;
                    }
                    this.screen.addCursor();
                }
                break;
        }
    };

    // Interpret a single-character command from the menu.
    IDE.prototype._interpretCommand = function (ch) {
        this.screen.printBold(ch);
        this.screen.newLine();

        switch (ch) {
            case "D":
                this._dir();
                break;

            case "E":
                this._edit();
                break;

            case "R":
                this._run();
                break;

            case "W":
                this._workFile();
                break;

            case "X":
                this._debug();
                break;

            default:
                this.screen.print("Command ");
                this.screen.printBold(ch);
                this.screen.print(" is not implemented. Try ");
                this.screen.printBold("D");
                this.screen.print(", ");
                this.screen.printBold("E");
                this.screen.print(", ");
                this.screen.printBold("R");
                this.screen.print(", ");
                this.screen.printBold("W");
                this.screen.print(", or ");
                this.screen.printBold("X");
                this.screen.print(".");
                this.printPrompt();
                break;
        }
    };

    // Show the directory of files.
    IDE.prototype._dir = function () {
        for (var i = 0; i < FILES.length; i++) {
            var file = FILES[i];
            this.screen.printBold(utils.leftAlign(file, 15));
            if (i % 5 == 4 || i == FILES.length - 1) {
                this.screen.newLine();
            }
        }
        this.printPrompt();
    };

    // Pop up the editor.
    IDE.prototype._edit = function () {
        var $editor = $("#editor");
        $("#screen").hide();
        $editor.show();
        $editor.val(this.source);
        $editor.focus();
        this._setInputMode(INPUT_EDITOR);
    };

    // End editing.
    IDE.prototype._closeEditor = function () {
        var $editor = $("#editor");
        this.source = $editor.val();
        $editor.hide();
        $("#screen").show();
        this.printMenu();
    };

    // Run the program.
    IDE.prototype._run = function () {
        var self = this;

        if (this.source === "") {
            this.screen.print("Must load program first.");
            this.screen.newLine();
            this.printPrompt();
            return;
        }

        var DUMP_TREE = true;
        var DUMP_BYTECODE = true;
        var DEBUG_TRACE = false;

        var stream = new Stream(this.source);
        var lexer = new CommentStripper(new Lexer(stream));
        var parser = new Parser(lexer);

        try {
            // Create the symbol table of built-in constants, functions, and procedures.
            var builtinSymbolTable = SymbolTable.makeBuiltinSymbolTable();

            // Parse the program into a parse tree. Create the symbol table as we go.
            var before = new Date().getTime();
            var root = parser.parse(builtinSymbolTable);
            /// console.log("Parsing: " + (new Date().getTime() - before) + "ms");
            if (DUMP_TREE) {
                var output = root.print("");
                $("#parseTree").text(output);
            }

            // Compile to bytecode.
            before = new Date().getTime();
            var compiler = new Compiler();
            var bytecode = compiler.compile(root);
            /// console.log("Code generation: " + (new Date().getTime() - before) + "ms");
            if (DUMP_BYTECODE) {
                var output = bytecode.print();
                $("#bytecode").text(output);
            }

            // Execute the bytecode.
            var machine = new Machine(bytecode, this.keyboard);
            var $state = $("#state");
            if (DEBUG_TRACE) {
                machine.setDebugCallback(function (state) {
                    $state.append(state + "\n");
                });
            }
            machine.setFinishCallback(function (runningTime) {
                /// console.log("Finished program: " + runningTime + "s");
                $("#canvas").hide();
                $("#screen").show();
                self.printPrompt();
            });
            machine.setOutputCallback(function (line) {
                self.screen.print(line);
                self.screen.newLine();
            });

            this._setInputMode(INPUT_RUNNING);
            machine.run();
        } catch (e) {
            // Print parsing errors.
            if (e instanceof PascalError) {
                console.log(e.getMessage());
                this.screen.printBold(e.getMessage());
                this.screen.newLine();
                this.printPrompt();
            }
            console.log(e.stack);
        }
    };

    // Change the work file.
    IDE.prototype._workFile = function () {
        var self = this;

        this.screen.newLine();
        this.screen.printBold("Work file name: ");
        this.screen.addCursor();
        this._setInputMode(INPUT_STRING, function (workFile) {
            workFile = workFile.toUpperCase();
            if (workFile === "") {
                self.printPrompt();
            } else if (FILES.indexOf(workFile) === -1) {
                self.screen.printBold("File not found: " + workFile);
                self.screen.newLine();
                self.printPrompt();
            } else {
                self.workFile = workFile;

                $.ajax(workFile, {
                    dataType: "text",
                    isLocal: true,
                    error: function () {
                        self.screen.printBold("File can't be loaded: " + workFile);
                        self.screen.newLine();
                        self.printPrompt();
                    },
                    success: function (source) {
                        self.source = source;
                        self.printMenu();
                    }
                });
            }
        });
    };

    // Toggle debug information.
    IDE.prototype._debug = function () {
        $(".debug-output").toggle();
        this.screen.print("Toggling debug information.");
        this.screen.newLine();
        this.printPrompt();
    };

    return IDE;
});
