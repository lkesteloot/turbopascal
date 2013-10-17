// Parses a lexer's output into a tree of Node objects.

'use strict';

define(["Token", "Node", "PascalError", "inst", "SymbolTable", "Symbol", "modules", "RawData"],
       function (Token, Node, PascalError, inst, SymbolTable, Symbol, modules, RawData) {

    var Parser = function (lexer) {
        this.lexer = lexer;
    };

    // Parse an entire Pascal program.
    Parser.prototype.parse = function (symbolTable) {
        var node = this._parseSubprogramDeclaration(symbolTable, Node.PROGRAM);

        return node;
    };

    // Returns whether there are more entities to come. The function is given
    // two symbols, one that's a separator and one's that a terminator. Returns
    // true and eats the symbol if it sees the separator; returns false and
    // leaves the symbol if it sees the terminator. Throws if it sees anything else.
    Parser.prototype._moreToCome = function (separator, terminator) {
        var token = this.lexer.peek();
        if (token.isSymbol(separator)) {
            // More to come. Eat the separator.
            this.lexer.next();
            return true;
        } else if (token.isSymbol(terminator)) {
            // We're done. Leave the terminator.
            return false;
        } else {
            throw new PascalError(token, "expected \"" + separator +
                                  "\" or \"" + terminator + "\"");
        }
    };

    // Eats the next symbol. If it's not this reserved word, raises an error with this
    // message. Returns the token.
    Parser.prototype._expectReservedWord = function (reservedWord, message) {
        var token = this.lexer.next();
        message = message || ("expected reserved word \"" + reservedWord + "\"");
        if (!token.isReservedWord(reservedWord)) {
            throw new PascalError(token, message);
        }
        return token;
    };

    // Eats the next symbol (such as ":="). If it's not this symbol, raises an
    // error with this message. Returns the token.
    Parser.prototype._expectSymbol = function (symbol, message) {
        var token = this.lexer.next();
        if (token.tokenType !== Token.SYMBOL || token.value !== symbol) {
            message = message || ("expected symbol \"" + symbol + "\"");
            throw new PascalError(token, message);
        }
        return token;
    };

    // Eats the next symbol. If it's not an identifier, raises an error with this
    // message. Returns the identifier token.
    Parser.prototype._expectIdentifier = function (message) {
        var token = this.lexer.next();
        if (token.tokenType !== Token.IDENTIFIER) {
            throw new PascalError(token, message);
        }
        return token;
    };

    // Returns a list of declarations (var, etc.).
    Parser.prototype._parseDeclarations = function (symbolTable) {
        var declarations = [];

        // Parse each declaration or block.
        while (!this.lexer.peek().isReservedWord("begin")) {
            // This parser also eats the semicolon after the declaration.
            var nodes = this._parseDeclaration(symbolTable);

            // Extend the declarations array with the nodes array.
            declarations.push.apply(declarations, nodes);
        }

        return declarations;
    }

    // Parse any declaration (uses, var, procedure, function). Returns a list
    // of them, in case a declaration expands to be multiple nodes.
    Parser.prototype._parseDeclaration = function (symbolTable) {
        var token = this.lexer.peek();

        if (token.isReservedWord("uses")) {
            return this._parseUsesDeclaration(symbolTable);
        } else if (token.isReservedWord("var")) {
            this._expectReservedWord("var");
            return this._parseVarDeclaration(symbolTable);
        } else if (token.isReservedWord("const")) {
            this._expectReservedWord("const");
            return this._parseConstDeclaration(symbolTable);
        } else if (token.isReservedWord("type")) {
            this._expectReservedWord("type");
            return this._parseTypeDeclaration(symbolTable);
        } else if (token.isReservedWord("procedure")) {
            return [this._parseSubprogramDeclaration(symbolTable, Node.PROCEDURE)];
        } else if (token.isReservedWord("function")) {
            return [this._parseSubprogramDeclaration(symbolTable, Node.FUNCTION)];
        } else if (token.tokenType === Token.EOF) {
            throw new PascalError(token, "unexpected end of file");
        } else {
            throw new PascalError(token, "unexpected token");
        }
    };

    // Parse "uses" declaration, which is a list of identifiers. Returns a list of nodes.
    Parser.prototype._parseUsesDeclaration = function (symbolTable) {
        var usesToken = this._expectReservedWord("uses");

        var nodes = [];

        do {
            var token = this._expectIdentifier("expected module name");
            var node = new Node(Node.USES, usesToken, {
                name: new Node(Node.IDENTIFIER, token)
            });

            // Import the module's symbols into this symbol table.
            modules.importModule(token.value, symbolTable);

            nodes.push(node);
        } while (this._moreToCome(",", ";"));

        this._expectSymbol(";");

        return nodes;
    };

    // Parse "var" declaration, which is a variable and its type. Returns a list of nodes.
    Parser.prototype._parseVarDeclaration = function (symbolTable) {
        var nodes = [];

        do {
            var startNode = nodes.length;

            do {
                var nameToken = this._expectIdentifier("expected variable name");
                var node = new Node(Node.VAR, null, {
                    name: new Node(Node.IDENTIFIER, nameToken)
                });
                nodes.push(node);
            } while (this._moreToCome(",", ":"));

            // Skip colon.
            this._expectSymbol(":");

            // Parse the variable's type.
            var type = this._parseType(symbolTable);

            // Set the type of all nodes for this line.
            for (var i = startNode; i < nodes.length; i++) {
                nodes[i].type = type;

                // Add the variable to our own symbol table.
                nodes[i].symbol = symbolTable.addSymbol(
                    nodes[i].name.token.value, Node.VAR, type);
            }

            // We always finish the line with a semicolon.
            this._expectSymbol(";");

            // If the next token is an identifier, then we keep going.
        } while (this.lexer.peek().tokenType === Token.IDENTIFIER);

        return nodes;
    };

    // Parse "const" declaration, which is an identifier, optional type, and
    // required value. Returns an array of nodes.
    Parser.prototype._parseConstDeclaration = function (symbolTable) {
        var nodes = [];

        do {
            // Parse the constant name.
            var token = this._expectIdentifier("expected constant name");
            var identifierNode = new Node(Node.IDENTIFIER, token);

            // Parse optional type.
            var type = null;
            token = this.lexer.peek();
            if (token.isSymbol(":")) {
                this.lexer.next();
                type = this._parseType(symbolTable);
            }

            // Parse value. How we do this depends on whether it's a typed constant,
            // and if it is, what kind.
            this._expectSymbol("=");

            // Create the node.
            var node;
            if (type === null) {
                // Constant.
                var expression = this._parseExpression(symbolTable);
                node = new Node(Node.CONST, null, {
                    name: identifierNode,
                    type: expression.expressionType,
                    value: expression
                });
            } else {
                // Typed constant.
                var rawData;

                // XXX We need to verify type compatibility throughout here.
                if (type.nodeType === Node.ARRAY_TYPE) {
                    rawData = this._parseArrayConstant(symbolTable, type);
                } else if (type.nodeType === Node.RECORD_TYPE) {
                    throw new PascalError(token, "constant records not supported");
                } else if (type.nodeType === Node.SIMPLE_TYPE) {
                    rawData = new RawData();
                    rawData.addNode(this._parseExpression(symbolTable));
                } else {
                    throw new PascalError(token, "unhandled typed constant type " + type.nodeType);
                }

                node = new Node(Node.TYPED_CONST, null, {
                    name: identifierNode,
                    type: type,
                    rawData: rawData 
                });
            }

            // Add the constant to our own symbol table.
            node.symbol = symbolTable.addSymbol(identifierNode.token.value,
                                                node.nodeType, node.type);
            if (type === null) {
                node.symbol.value = node.value;
            }
            nodes.push(node);

            // Semicolon terminator.
            this._expectSymbol(";");
        } while (this.lexer.peek().tokenType === Token.IDENTIFIER);

        return nodes;
    };

    // Parse an array constant, which is a parenthesized list of constants. These
    // can be nested for multi-dimensional arrays. Returns a RawData object.
    Parser.prototype._parseArrayConstant = function (symbolTable, type) {
        // The raw linear (in-memory) version of the data.
        var rawData = new RawData();

        // Recursive function to parse a dimension of the array. The first
        // dimension (ranges[0]) is the "major" one, and we recurse until
        // the last dimension, where we actually parse the constant
        // expressions.
        var self = this;
        var parseDimension = function (d) {
            self._expectSymbol("(");

            var low = type.ranges[d].getRangeLowBound();
            var high = type.ranges[d].getRangeHighBound();
            for (var i = low; i <= high; i++) {
                if (d === type.ranges.length - 1) {
                    // Parse the next constant.
                    rawData.addNode(self._parseExpression(symbolTable));
                } else {
                    parseDimension(d + 1);
                }
                if (i < high) {
                    self._expectSymbol(",");
                }
            }

            self._expectSymbol(")");
        };

        // Start the recursion.
        parseDimension(0);

        return rawData;
    };

    // Parse "type" declaration, which is an identifier and a type. Returns an
    // array of nodes.
    Parser.prototype._parseTypeDeclaration = function (symbolTable) {
        var nodes = [];

        // Pointer types are permitted to point to an undefined type name, as long as
        // that name is defined by the end of the "type" section. We keep track of these
        // here and resolve them at the end.
        var incompleteTypes = [];

        do {
            // Parse identifier.
            var token = this._expectIdentifier("expected type name");
            var identifierNode = new Node(Node.IDENTIFIER, token);

            // Required equal sign.
            var equalToken = this._expectSymbol("=");

            // Parse type.
            var type = this._parseType(symbolTable, incompleteTypes);

            // Create the node.
            var node = new Node(Node.TYPE, equalToken, {
                name: identifierNode,
                type: type,
            });

            // Add the type to our own symbol table.
            node.symbol = symbolTable.addType(identifierNode.token.value, type);
            nodes.push(node);

            // Semicolon terminator.
            this._expectSymbol(";");
        } while (this.lexer.peek().tokenType === Token.IDENTIFIER);

        // Fill in incomplete types. They're required to be defined by the end of
        // the "type" block.
        for (var i = 0; i < incompleteTypes.length; i++) {
            var node = incompleteTypes[i];

            node.type = symbolTable.getType(node.typeName.token).symbol.type;
        }

        return nodes;
    };

    // Parse procedure, function, or program declaration.
    Parser.prototype._parseSubprogramDeclaration = function (symbolTable, nodeType) {
        // Get the string like "procedure", etc.
        var declType = Node.nodeLabel[nodeType];

        // Parse the opening token.
        var procedureToken = this._expectReservedWord(declType);

        // Parse the name.
        var nameToken = this._expectIdentifier("expected " + declType + " name");

        // From now on we're in our own table.
        var symbolTable = new SymbolTable(symbolTable);

        // Parse the parameters.
        var token = this.lexer.peek();
        var parameters = [];
        if (token.isSymbol("(")) {
            this._expectSymbol("(");

            var start = 0;
            do {
                var byReference = false;

                // See if we're passing this batch by reference.
                if (this.lexer.peek().isReservedWord("var")) {
                    this._expectReservedWord("var");
                    byReference = true;
                }

                // Parameters can be batched by type.
                do {
                    token = this._expectIdentifier("expected parameter name");
                    parameters.push(new Node(Node.PARAMETER, colon, {
                        name: new Node(Node.IDENTIFIER, token),
                        byReference: byReference
                    }));
                } while (this._moreToCome(",", ":"));
                var colon = this._expectSymbol(":");

                // Add the type to each parameter.
                var type = this._parseType(symbolTable);
                for (var i = start; i < parameters.length; i++) {
                    parameters[i].type = type;
                }
                start = parameters.length;
            } while (this._moreToCome(";", ")"));

            this._expectSymbol(")");
        }

        // Add parameters to our own symbol table.
        for (var i = 0; i < parameters.length; i++) {
            var parameter = parameters[i];
            var symbol = symbolTable.addSymbol(parameter.name.token.value, Node.PARAMETER,
                                               parameter.type, parameter.byReference);
        }

        // Parse the return type if it's a function.
        var returnType;
        if (nodeType === Node.FUNCTION) {
            this._expectSymbol(":");
            returnType = this._parseType(symbolTable);
        } else {
            returnType = Node.voidType;
        }
        this._expectSymbol(";");

        // Functions have an additional fake symbol: their own name, which maps
        // to the mark pointer location (return value).
        if (nodeType === Node.FUNCTION) {
            var name = nameToken.value;
            symbolTable.symbols[name.toLowerCase()] = new Symbol(name, returnType, 0, false);
        }

        // Create the type of the subprogram itself.
        var type = new Node(Node.SUBPROGRAM_TYPE, procedureToken, {
            parameters: parameters,
            returnType: returnType,
        });

        // Add the procedure to our parent symbol table.
        var symbol = symbolTable.parentSymbolTable.addSymbol(nameToken.value,
                                                             Node.SUBPROGRAM_TYPE, type);

        // Parse declarations.
        var declarations = this._parseDeclarations(symbolTable);

        // Parse begin/end block.
        var block = this._parseBlock(symbolTable, "begin", "end");

        // Make node.
        var node = new Node(nodeType, procedureToken, {
            name: new Node(Node.IDENTIFIER, nameToken),
            declarations: declarations,
            block: block
        });
        node.symbol = symbol;
        node.symbolTable = symbolTable;
        node.expressionType = type;

        // Semicolon terminator.
        this._expectSymbol(nodeType === Node.PROGRAM ? "." : ";");

        return node;
    };

    // Parse a begin/end block. The startWord must be the next token. The endWord
    // will end the block and is eaten.
    Parser.prototype._parseBlock = function (symbolTable, startWord, endWord) {
        var token = this._expectReservedWord(startWord);
        var statements = [];

        var foundEnd = false;
        while (!foundEnd) {
            token = this.lexer.peek();
            if (token.isReservedWord(endWord)) {
                // End of block.
                this.lexer.next();
                foundEnd = true;
            } else if (token.isSymbol(";")) {
                // Empty statement.
                this.lexer.next();
            } else {
                // Parse statement.
                statements.push(this._parseStatement(symbolTable));

                // After an actual statement, we require a semicolon or end of block.
                token = this.lexer.peek();
                if (!token.isReservedWord(endWord) && !token.isSymbol(";")) {
                    throw new PascalError(token, "expected \";\" or \"" + endWord + "\"");
                }
            }
        }

        return new Node(Node.BLOCK, token, {
            statements: statements
        });
    };

    // Parse a statement, such as a for loop, while loop, assignment, or procedure call.
    Parser.prototype._parseStatement = function (symbolTable) {
        var token = this.lexer.peek();
        var node;

        // Handle simple constructs.
        if (token.isReservedWord("if")) {
            node = this._parseIfStatement(symbolTable);
        } else if (token.isReservedWord("while")) {
            node = this._parseWhileStatement(symbolTable);
        } else if (token.isReservedWord("repeat")) {
            node = this._parseRepeatStatement(symbolTable);
        } else if (token.isReservedWord("for")) {
            node = this._parseForStatement(symbolTable);
        } else if (token.isReservedWord("begin")) {
            node = this._parseBlock(symbolTable, "begin", "end");
        } else if (token.isReservedWord("exit")) {
            node = this._parseExitStatement(symbolTable);
        } else if (token.tokenType === Token.IDENTIFIER) {
            // This could be an assignment or procedure call. Both start with an identifier.
            node = this._parseVariable(symbolTable);

            // See if this is an assignment or procedure call.
            token = this.lexer.peek();
            if (token.isSymbol(":=")) {
                // It's an assignment.
                node = this._parseAssignment(symbolTable, node);
            } else if (node.nodeType === Node.IDENTIFIER) {
                // Must be a procedure call.
                node = this._parseProcedureCall(symbolTable, node);
            } else {
                throw new PascalError(token, "invalid statement");
            }
        } else {
            throw new PascalError(token, "invalid statement");
        }

        return node;
    };

    // Parse a variable. A variable isn't just an identifier, like "foo", it can also
    // be an array dereference, like "variable[index]", a field designator, like
    // "variable.fieldName", or a pointer dereference, like "variable^". In all
    // three cases the "variable" part is itself a variable. This function always
    // returns a node of type IDENTIFIER, ARRAY, FIELD_DESIGNATOR, or DEREFERENCE.
    Parser.prototype._parseVariable = function (symbolTable) {
        // Variables always start with an identifier.
        var identifierToken = this._expectIdentifier("expected identifier");

        // Create an identifier node for this token.
        var node = new Node(Node.IDENTIFIER, identifierToken);

        // Look up the symbol so we can set its type.
        var symbolLookup = symbolTable.getSymbol(identifierToken);
        node.symbolLookup = symbolLookup;
        node.expressionType = symbolLookup.symbol.type;

        // The next token determines whether the variable continues or ends here.
        while (true) {
            var nextToken = this.lexer.peek();
            if (nextToken.isSymbol("[")) {
                // Replace the node with an array node.
                node = this._parseArrayDereference(symbolTable, node);
            } else if (nextToken.isSymbol(".")) {
                // Replace the node with a record designator node.
                node = this._parseRecordDesignator(symbolTable, node);
            } else if (nextToken.isSymbol("^")) {
                // Replace the node with a pointer dereference.
                this._expectSymbol("^");
                var variable = node;
                if (!variable.expressionType.isSimpleType(inst.A)) {
                    throw new PascalError(nextToken, "can only dereference pointers");
                }
                node = new Node(Node.DEREFERENCE, nextToken, {
                    variable: node
                });
                node.expressionType = variable.expressionType.type;
            } else {
                // We're done with the variable.
                break;
            }
        }

        return node;
    };

    // Parse an assignment. We already have the left-hand-side variable.
    Parser.prototype._parseAssignment = function (symbolTable, variable) {
        var assignToken = this._expectSymbol(":=");

        var expression = this._parseExpression(symbolTable);
        return new Node(Node.ASSIGNMENT, assignToken, {
            lhs: variable,
            rhs: expression.castToType(variable.expressionType)
        });
    };

    // Parse a procedure call. We already have the identifier, so we only need to
    // parse the optional arguments.
    Parser.prototype._parseProcedureCall = function (symbolTable, identifier) {
        // Look up the symbol to make sure it's a procedure.
        var symbolLookup = symbolTable.getSymbol(identifier.token);
        var symbol = symbolLookup.symbol;
        identifier.symbolLookup = symbolLookup;

        // Verify that it's a procedure.
        if (symbol.type.nodeType === Node.SUBPROGRAM_TYPE && symbol.type.returnType.isVoidType()) {
            // Parse optional arguments.
            var argumentList = this._parseArguments(symbolTable, symbol.type);

            // If the call is to the native function "New", then we pass a hidden second
            // parameter, the size of the object to allocate. The procedure needs that
            // to know how much to allocate.
            if (symbol.name.toLowerCase() === "new" && symbol.isNative) {
                if (argumentList.length === 1) {
                    argumentList.push(Node.makeNumberNode(
                        argumentList[0].expressionType.type.getTypeSize()));
                } else {
                    throw new PascalError(identifier.token, "new() takes one argument");
                }
            }

            return new Node(Node.PROCEDURE_CALL, identifier.token, {
                name: identifier,
                argumentList: argumentList
            });
        } else {
            throw new PascalError(identifier.token, "expected procedure");
        }
    };

    // Parse an optional argument list. Returns a list of nodes. type is the
    // type of the subprogram being called.
    Parser.prototype._parseArguments = function (symbolTable, type) {
        var argumentList = [];

        if (this.lexer.peek().isSymbol("(")) {
            this._expectSymbol("(");
            var token = this.lexer.peek();
            if (token.isSymbol(")")) {
                // Empty arguments.
                this.lexer.next();
            } else {
                do {
                    // Find the formal parameter. Some functions (like WriteLn)
                    // are variadic, so allow them to have more arguments than
                    // were defined.
                    var argumentIndex = argumentList.length;
                    var parameter;
                    if (argumentIndex < type.parameters.length) {
                        parameter = type.parameters[argumentIndex];
                    } else {
                        // Accept anything (by value).
                        parameter = null;
                    }

                    var argument;
                    if (parameter && parameter.byReference) {
                        // This has to be a variable, not any expression, since
                        // we need its address.
                        argument = this._parseVariable(symbolTable);

                        // Hack this "byReference" field that'll be used by
                        // the compiler to pass the argument's address.
                        argument.byReference = true;
                    } else {
                        argument = this._parseExpression(symbolTable);
                    }

                    // Cast to type of parameter.
                    if (parameter) {
                        argument = argument.castToType(parameter.type);
                    }

                    argumentList.push(argument);
                } while (this._moreToCome(",", ")"));
                this._expectSymbol(")");
            }
        }

        return argumentList;
    }

    // Parse an if statement.
    Parser.prototype._parseIfStatement = function (symbolTable) {
        var token = this._expectReservedWord("if");

        var expression = this._parseExpression(symbolTable);
        if (!expression.expressionType.isBooleanType()) {
            throw new PascalError(expression.token, "if condition must be a boolean");
        }

        this._expectReservedWord("then");
        var thenStatement = this._parseStatement(symbolTable);

        var elseStatement = null;
        var elseToken = this.lexer.peek();
        if (elseToken.isReservedWord("else")) {
            this._expectReservedWord("else");
            var elseStatement = this._parseStatement(symbolTable);
        }

        return new Node(Node.IF, token, {
            expression: expression,
            thenStatement: thenStatement,
            elseStatement: elseStatement
        });
    };

    // Parse a while statement.
    Parser.prototype._parseWhileStatement = function (symbolTable) {
        var whileToken = this._expectReservedWord("while");

        // Parse the expression that keeps the loop going.
        var expression = this._parseExpression(symbolTable);
        if (!expression.expressionType.isBooleanType()) {
            throw new PascalError(whileToken, "while condition must be a boolean");
        }

        // The "do" keyword is required.
        this._expectReservedWord("do", "expected \"do\" for \"while\" loop");

        // Parse the statement. This can be a begin/end pair.
        var statement = this._parseStatement(symbolTable);

        // Create the node.
        return new Node(Node.WHILE, whileToken, {
            expression: expression,
            statement: statement
        });
    };

    // Parse a repeat/until statement.
    Parser.prototype._parseRepeatStatement = function (symbolTable) {
        var block = this._parseBlock(symbolTable, "repeat", "until");
        var expression = this._parseExpression(symbolTable);
        if (!expression.expressionType.isBooleanType()) {
            throw new PascalError(node.token, "repeat condition must be a boolean");
        }

        return new Node(Node.REPEAT, block.token, {
            block: block,
            expression: expression
        });
    };

    // Parse a for statement.
    Parser.prototype._parseForStatement = function (symbolTable) {
        var token = this._expectReservedWord("for");

        var loopVariableToken = this._expectIdentifier("expected identifier for \"for\" loop");
        this._expectSymbol(":=");
        var fromExpr = this._parseExpression(symbolTable);
        var downto = this.lexer.peek().isReservedWord("downto");
        if (downto) {
            this._expectReservedWord("downto");
        } else {
            // Default error message if it's neither.
            this._expectReservedWord("to");
        }
        var toExpr = this._parseExpression(symbolTable);
        this._expectReservedWord("do");
        var body = this._parseStatement(symbolTable);

        // Get the symbol for the loop variable.
        var symbolLookup = symbolTable.getSymbol(loopVariableToken);
        var loopVariableType = symbolLookup.symbol.type;
        var variable = new Node(Node.IDENTIFIER, loopVariableToken);
        variable.symbolLookup = symbolLookup;

        // Cast "from" and "to" to type of variable.
        fromExpr = fromExpr.castToType(loopVariableType);
        toExpr = toExpr.castToType(loopVariableType);

        return new Node(Node.FOR, token, {
            variable: variable,
            fromExpr: fromExpr,
            toExpr: toExpr,
            body: body,
            downto: downto
        });
    };

    // Parse an exit statement.
    Parser.prototype._parseExitStatement = function (symbolTable) {
        var token = this._expectReservedWord("exit");

        return new Node(Node.EXIT, token);
    };

    // Parse a type declaration, such as "Integer" or "Array[1..70] of Real".
    // The "incompleteTypes" array is optional. If specified, and if a pointer
    // to an unknown type is found, it is added to the array. If such a pointer
    // is found and the array was not passed in, we throw.
    Parser.prototype._parseType = function (symbolTable, incompleteTypes) {
        var token = this.lexer.next();
        var node;

        if (token.isReservedWord("array")) {
            // Array type.
            this._expectSymbol("[");
            var ranges = [];
            // Parse multiple ranges.
            do {
                var range = this._parseRange(symbolTable);
                ranges.push(range);
            } while (this._moreToCome(",", "]"));
            this._expectSymbol("]");
            this._expectReservedWord("of");
            var elementType = this._parseType(symbolTable, incompleteTypes);

            node = new Node(Node.ARRAY_TYPE, token, {
                elementType: elementType,
                ranges: ranges
            });
        } else if (token.isReservedWord("record")) {
            node = this._parseRecordType(symbolTable, token, incompleteTypes);
        } else if (token.isSymbol("^")) {
            var typeNameToken = this._expectIdentifier("expected type identifier");
            var type;
            try {
                type = symbolTable.getType(typeNameToken).symbol.type;
            } catch (e) {
                if (e instanceof PascalError) {
                    // The type symbol is not defined. Pascal requires that it be defined
                    // by the time the "type" section ends.
                    type = null;
                } else {
                    throw new PascalError(typeNameToken, "exception looking up type symbol");
                }
            }
            node = new Node(Node.SIMPLE_TYPE, token, {
                typeCode: inst.A,
                typeName: new Node(Node.IDENTIFIER, typeNameToken),
                type: type
            });
            // See if this is a forward type reference.
            if (type === null) {
                // We'll fill these in later.
                if (incompleteTypes) {
                    incompleteTypes.push(node);
                } else {
                    throw new PascalError(typeNameToken, "unknown type");
                }
            }
        } else if (token.tokenType === Token.IDENTIFIER) {
            // Type name.
            var symbolLookup = symbolTable.getType(token);

            // Substitute the type right away. This will mess up the display of
            // the program, since you'll see the full type everywhere, but will
            // simplify the compilation step.
            node = symbolLookup.symbol.type;
        } else {
            throw new PascalError(token, "can't parse type");
        }

        // A type node is its own type.
        node.expressionType = node;

        return node;
    };

    // Parse a record type definition. See _parseType() for an explanation of "incompleteTypes".
    Parser.prototype._parseRecordType = function (symbolTable, token, incompleteTypes) {
        // A record is a list of fields.
        var fields = [];

        while (true) {
            var token = this.lexer.peek();
            if (token.isSymbol(";")) {
                // Empty field, no problem.
                this.lexer.next();
            } else if (token.isReservedWord("end")) {
                // End of record.
                this._expectReservedWord("end");
                break;
            } else {
                fields.push.apply(fields,
                                  this._parseRecordSection(symbolTable, token, incompleteTypes));
                // Must have ";" or "end" after field.
                var token = this.lexer.peek();
                if (!token.isSymbol(";") && !token.isReservedWord("end")) {
                    throw new PascalError(token, "expected \";\" or \"end\" after field");
                }
            }
        }

        // Calculate the offset of each field.
        var offset = 0;
        for (var i = 0; i < fields.length; i++) {
            var field = fields[i];
            field.offset = offset;
            offset += field.type.getTypeSize();
        }

        return new Node(Node.RECORD_TYPE, token, {
            fields: fields
        });
    };

    // Parse a section of a record type, which is a list of identifiers and
    // their type. Returns an array of FIELD nodes. See _parseType() for an
    // explanation of "incompleteTypes".
    Parser.prototype._parseRecordSection = function (symbolTable, fieldToken, incompleteTypes) {
        var fields = [];

        do {
            var nameToken = this._expectIdentifier("expected field name");
            var field = new Node(Node.FIELD, fieldToken, {
                name: new Node(Node.IDENTIFIER, nameToken),
                offset: 0
            });
            fields.push(field);
        } while (this._moreToCome(",", ":"));

        // Skip colon.
        this._expectSymbol(":");

        // Parse the fields's type.
        var type = this._parseType(symbolTable, incompleteTypes);

        // Set the type of all fields.
        for (var i = 0; i < fields.length; i++) {
            fields[i].type = type;
        }

        return fields;
    };

    // Parses a range, such as "5..10". Either can be a constant expression.
    Parser.prototype._parseRange = function (symbolTable) {
        var low = this._parseExpression(symbolTable);
        var token = this._expectSymbol("..");
        var high = this._parseExpression(symbolTable);

        return new Node(Node.RANGE, token, {low: low, high: high});
    };

    // Parses an expression.
    Parser.prototype._parseExpression = function (symbolTable) {
        return this._parseRelationalExpression(symbolTable);
    };

    // Parses a relational expression.
    Parser.prototype._parseRelationalExpression = function (symbolTable) {
        var node = this._parseAdditiveExpression(symbolTable);

        while (true) {
            var token = this.lexer.peek();
            if (token.isSymbol("=")) {
                node = this._createBinaryNode(symbolTable, token, node, Node.EQUALITY,
                        this._parseAdditiveExpression).withExpressionType(Node.booleanType);
            } else if (token.isSymbol("<>")) {
                node = this._createBinaryNode(symbolTable, token, node, Node.INEQUALITY,
                        this._parseAdditiveExpression).withExpressionType(Node.booleanType);
            } else if (token.isSymbol(">")) {
                node = this._createBinaryNode(symbolTable, token, node, Node.GREATER_THAN,
                        this._parseAdditiveExpression).withExpressionType(Node.booleanType);
            } else if (token.isSymbol("<")) {
                node = this._createBinaryNode(symbolTable, token, node, Node.LESS_THAN,
                        this._parseAdditiveExpression).withExpressionType(Node.booleanType);
            } else if (token.isSymbol(">=")) {
                node = this._createBinaryNode(symbolTable, token, node,
                                              Node.GREATER_THAN_OR_EQUAL_TO,
                        this._parseAdditiveExpression).withExpressionType(Node.booleanType);
            } else if (token.isSymbol("<=")) {
                node = this._createBinaryNode(symbolTable, token, node, Node.LESS_THAN_OR_EQUAL_TO,
                        this._parseAdditiveExpression).withExpressionType(Node.booleanType);
            } else {
                break;
            }
        }

        return node;
    };

    // Parses an additive expression.
    Parser.prototype._parseAdditiveExpression = function (symbolTable) {
        var node = this._parseMultiplicativeExpression(symbolTable);

        while (true) {
            var token = this.lexer.peek();
            if (token.isSymbol("+")) {
                node = this._createBinaryNode(symbolTable, token, node, Node.ADDITION,
                                              this._parseMultiplicativeExpression);
            } else if (token.isSymbol("-")) {
                node = this._createBinaryNode(symbolTable, token, node, Node.SUBTRACTION,
                                              this._parseMultiplicativeExpression);
            } else if (token.isReservedWord("or")) {
                node = this._createBinaryNode(symbolTable, token, node, Node.OR,
                                              this._parseMultiplicativeExpression,
                                              Node.booleanType);
            } else {
                break;
            }
        }

        return node;
    };

    // Parses a multiplicative expression.
    Parser.prototype._parseMultiplicativeExpression = function (symbolTable) {
        var node = this._parseUnaryExpression(symbolTable);

        while (true) {
            var token = this.lexer.peek();
            if (token.isSymbol("*")) {
                node = this._createBinaryNode(symbolTable, token, node, Node.MULTIPLICATION,
                                              this._parseUnaryExpression);
            } else if (token.isSymbol("/")) {
                node = this._createBinaryNode(symbolTable, token, node, Node.DIVISION,
                                              this._parseUnaryExpression, Node.realType);
            } else if (token.isReservedWord("div")) {
                node = this._createBinaryNode(symbolTable, token, node, Node.INTEGER_DIVISION,
                                              this._parseUnaryExpression, Node.integerType);
            } else if (token.isReservedWord("mod")) {
                node = this._createBinaryNode(symbolTable, token, node, Node.MOD,
                                              this._parseUnaryExpression, Node.integerType);
            } else if (token.isReservedWord("and")) {
                node = this._createBinaryNode(symbolTable, token, node, Node.AND,
                                              this._parseUnaryExpression, Node.booleanType);
            } else {
                break;
            }
        }

        return node;
    };

    // Parses a unary expression, such as a negative sign or a "not".
    Parser.prototype._parseUnaryExpression = function (symbolTable) {
        var node;

        // Parse unary operator.
        var token = this.lexer.peek();
        if (token.isSymbol("-")) {
            // Negation.
            this._expectSymbol("-");

            var expression = this._parseUnaryExpression(symbolTable);
            node = new Node(Node.NEGATIVE, token, {
                expression: expression
            }).withExpressionTypeFrom(expression);
        } else if (token.isSymbol("+")) {
            // Unary plus.
            this._expectSymbol("+");

            // Nothing to wrap sub-expression with.
            node = this._parseUnaryExpression(symbolTable);
        } else if (token.isReservedWord("not")) {
            // Logical not.
            this._expectReservedWord("not");

            var expression = this._parseUnaryExpression(symbolTable);
            if (!expression.expressionType.isBooleanType()) {
                throw new PascalError(expression.token, "not operand must be a boolean");
            }
            node = new Node(Node.NOT, token, {
                expression:expression
            }).withExpressionTypeFrom(expression);
        } else {
            node = this._parsePrimaryExpression(symbolTable);
        }

        return node;
    };

    // Parses an atomic expression, such as a number, identifier, or
    // parenthesized expression.
    Parser.prototype._parsePrimaryExpression = function (symbolTable) {
        var token = this.lexer.peek();
        var node;

        if (token.tokenType === Token.NUMBER) {
            // Numeric literal.
            token = this.lexer.next();
            node = new Node(Node.NUMBER, token);
            var v = node.getNumber();
            var typeCode;

            // See if we're an integer or real.
            if ((v | 0) === v) {
                typeCode = inst.I;
            } else {
                typeCode = inst.R;
            }

            // Set the type based on the kind of number we have. Really we should
            // have the lexer tell us, because JavaScript treats "2.0" the same as "2".
            node.expressionType = new Node(Node.SIMPLE_TYPE, token, {
                typeCode: typeCode
            });
        } else if (token.tokenType === Token.STRING) {
            // String literal.
            token = this.lexer.next();
            node = new Node(Node.STRING, token);
            node.expressionType = new Node(Node.SIMPLE_TYPE, token, {
                typeCode: inst.S
            });
        } else if (token.tokenType === Token.IDENTIFIER) {
            // Parse a variable (identifier, array dereference, etc.).
            node = this._parseVariable(symbolTable);

            // What we do next depends on the variable. If it's just an identifier,
            // then it could be a function call, a function call with arguments,
            // a constant, or a plain variable. We handle all these cases. If it's
            // not just an identifier, then we leave it alone.
            if (node.nodeType === Node.IDENTIFIER) {
                // Peek to see if we've got parentheses.
                var nextToken = this.lexer.peek();

                // Look up the symbol.
                var symbolLookup;
                if (nextToken.isSymbol("(")) {
                    // This is a hack to allow recursion. I don't know how a real Pascal
                    // parser might distinguish between a function and an identifier. Do
                    // we first check the parenthesis or first check the symbol type?
                    symbolLookup = symbolTable.getSymbol(node.token, Node.SUBPROGRAM_TYPE);
                } else {
                    symbolLookup = symbolTable.getSymbol(node.token);
                }
                var symbol = symbolLookup.symbol;
                node.symbolLookup = symbolLookup;

                if (symbol.type.nodeType === Node.SUBPROGRAM_TYPE) {
                    // We're calling a function. Make sure it's not a procedure.
                    if (symbol.type.returnType.isVoidType()) {
                        throw new PascalError(node.token, "can't call procedure in expression");
                    }

                    // Make the function call node with the optional arguments.
                    node = new Node(Node.FUNCTION_CALL, node.token, {
                        name: node,
                        argumentList: this._parseArguments(symbolTable, symbol.type)
                    });

                    // Type of the function call is the return type of the function.
                    node.expressionType = symbol.type.returnType;

                    // We have to hack the call to Random() because its return
                    // type depends on whether it takes a parameter or not.
                    // We detect that we're calling the built-in one and modify
                    // the return type to be an Integer if it takes a parameter.
                    if (symbol.name.toLowerCase() === "random" &&
                        symbol.isNative &&
                        node.argumentList.length > 0) {

                        // Return Integer.
                        node.expressionType = Node.integerType;
                    }

                    // Hack Abs() because its return type is the same as its parameter.
                    // If the parameter was an integer, then it's already been cast
                    // to a real in the argument parsing.
                    if (symbol.name.toLowerCase() === "abs" &&
                        symbol.isNative &&
                        node.argumentList.length === 1 &&
                        node.argumentList[0].nodeType === Node.CAST) {

                        node.expressionType = node.argumentList[0].expression.expressionType;
                    }
                } else {
                    // This is just a symbol. Check to see if it's a constant. If it is,
                    // replace it with the value.
                    if (symbol.value !== null) {
                        // Only for simple types.
                        node = symbol.value;
                    } else {
                        // Normal variable. Look up its type.
                        node.expressionType = symbol.type;
                    }
                }
            }
        } else if (token.isSymbol("(")) {
            // Parenthesized expression.
            this._expectSymbol("(");
            node = this._parseExpression(symbolTable);
            this._expectSymbol(")");
        } else if (token.isSymbol("@")) {
            // This doesn't work. It's not clear what the type of the resulting
            // expression is. It should be a pointer to a (say) integer, but
            // a pointer type requires a typeName, which we don't have and might
            // not have at all. If this variable is declared as being of type
            // record, then there's no name to use. And even if it uses a formal
            // type definition, we lose than when we look up the type of the variable.
            // None of our code uses this expression, so we're not going to support
            // it.
            throw new PascalError(token, "the @ operator is not supported");

            this._expectSymbol("@");
            var variable = this._parseVariable(symbolTable);
            node = new Node(Node.ADDRESS_OF, token, {
                variable: variable
            });
            node.expressionType = new Node(Node.SIMPLE_TYPE, token, {
                typeCode: inst.A,
                typeName: "AD-HOC",
                type: variable.expressionType
            });
        } else {
            throw new PascalError(token, "expected expression");
        }

        return node;
    };

    // Parse an array dereference, such as "a[2,3+4]".
    Parser.prototype._parseArrayDereference = function (symbolTable, variable) {
        // Make sure the variable is an array.
        if (variable.expressionType.nodeType !== Node.ARRAY_TYPE) {
            throw new PascalError(variable.token, "expected an array type");
        }

        var arrayToken = this._expectSymbol("[");
        var indices = [];
        do {
            // Indices must be integers.
            indices.push(this._parseExpression(symbolTable).castToType(Node.integerType));
        } while (this._moreToCome(",", "]"));
        this._expectSymbol("]");

        var array = new Node(Node.ARRAY, arrayToken, {
            variable: variable,
            indices: indices
        });

        // The type of the array lookup is the type of the array element.
        array.expressionType = variable.expressionType.elementType;

        return array;
    };

    // Parse a record designator, such as "a.b".
    Parser.prototype._parseRecordDesignator = function (symbolTable, variable) {
        // Make sure the variable so far is a record.
        var recordType = variable.expressionType;
        if (recordType.nodeType !== Node.RECORD_TYPE) {
            throw new PascalError(nextToken, "expected a record type");
        }

        var dotToken = this._expectSymbol(".", "expected a dot");

        // Parse the field name.
        var fieldToken = this._expectIdentifier("expected a field name");

        // Get the field for this identifier.
        var field = recordType.getField(fieldToken);

        // Create the new node.
        var node = new Node(Node.FIELD_DESIGNATOR, dotToken, {
            variable: variable,
            field: field
        });

        // Type of designation is the type of the field.
        node.expressionType = field.type;

        return node;
    };

    // Creates a binary node.
    //
    // token: the specific token, which must be next in the lexer.
    // node: the first (left) operand.
    // nodeType: the type of the binary node (Node.ADDITION, etc.).
    // rhsFn: the function to call to parse the RHS. It should take a symbolTable object
    //      and return an expression node.
    // forceType: optional type node (e.g., Node.realType). Both operands will be cast
    //      naturally to this type and the node will be of this type.
    Parser.prototype._createBinaryNode = function (symbolTable, token, node,
                                                   nodeType, rhsFn, forceType) {

        // It must be next, we've only peeked at it.
        if (token.tokenType === Token.SYMBOL) {
            this._expectSymbol(token.value);
        } else {
            this._expectReservedWord(token.value);
        }

        var operand1 = node;
        var operand2 = rhsFn.apply(this, [symbolTable]);

        var expressionType;
        if (forceType) {
            // Use what's passed in.
            expressionType = forceType;
        } else {
            // Figure it out from the operands.
            expressionType = this._getCompatibleType(token,
                                                     operand1.expressionType,
                                                     operand2.expressionType);
        }

        // Cast the operands if necessary.
        node = new Node(nodeType, token, {
                        lhs: operand1.castToType(expressionType),
                        rhs: operand2.castToType(expressionType)
        }).withExpressionType(expressionType);

        return node;
    };

    // Returns a type compatible for both operands. For example, if one is
    // integer and another is real, returns a real, since you can implicitly
    // cast from integer to real. Throws if a compatible type can't
    // be found. Token is passed in just for error reporting.
    Parser.prototype._getCompatibleType = function (token, type1, type2) {
        // Must have them defined.
        if (!type1) {
            throw new PascalError(token, "can't find compatible types for type1=null");
        }
        if (!type2) {
            throw new PascalError(token, "can't find compatible types for type2=null");
        }

        // Must be the same type of node. Can't cast between node types
        // (e.g., array to set).
        if (type1.nodeType !== type2.nodeType) {
            throw new PascalError(token, "basic types are incompatible: " +
                                 type1.print() + " and " + type2.print());
        }

        // Can cast between some simple types.
        if (type1.nodeType === Node.SIMPLE_TYPE &&
            type1.typeCode !== type2.typeCode) {

            // They're different.
            var typeCode1 = type1.typeCode;
            var typeCode2 = type2.typeCode;

            if (typeCode1 === inst.A || typeCode2 === inst.A ||
                typeCode1 === inst.B || typeCode2 === inst.B ||
                typeCode1 === inst.S || typeCode2 === inst.S ||
                typeCode1 === inst.T || typeCode2 === inst.T ||
                typeCode1 === inst.P || typeCode2 === inst.P ||
                typeCode1 === inst.X || typeCode2 === inst.X) {

                // These can't be cast.
                throw new PascalError(token, "no common type between " +
                                     inst.typeCodeToName(typeCode1) +
                                     " and " + inst.typeCodeToName(typeCode2));
            }

            // Can always cast to a real.
            if (typeCode1 === inst.R) {
                return type1;
            } else if (typeCode2 === inst.R) {
                return type2;
            }

            // Otherwise can cast to an integer.
            if (typeCode1 === inst.I) {
                return type1;
            } else if (typeCode2 === inst.I) {
                return type2;
            }

            // I don't know how we got here.
            throw new PascalError(token, "internal compiler error, can't determine " +
                                 "common type of " + typeCode1 + " and " + typeCode2);
        } else {
            // Return either type.
            return type1;
        }
    };

    return Parser;
});
