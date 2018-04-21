// Model class for syntactic nodes.

'use strict';

define(["inst", "PascalError", "Token", "utils"], function (inst, PascalError, Token, utils) {
    var Node = function (nodeType, token, additionalFields) {
        // The type of node (e.g., Node.PROGRAM), see below.
        this.nodeType = nodeType;

        // The token that created this node.
        this.token = token;

        // Symbol table (for node types PROGRAM, PROCEDURE, and FUNCTION).
        this.symbolTable = null;

        // Type of this node (for expressions).
        this.expressionType = null;

        // Symbol in the symbol table (if VAR, CONST, etc.).
        this.symbol = null;

        // Symbol lookup in the symbol table (if IDENTIFIER, ARRAY, FUNCTION_CALL, etc.).
        this.symbolLookup = null;

        // Fold other fields into our own.
        for (var field in additionalFields) {
            this[field] = additionalFields[field];
        }
    };

    // Basic types. These don't have additional fields, but their token usually has a value.
    Node.IDENTIFIER = 0;
    Node.NUMBER = 1;
    Node.STRING = 2;
    Node.BOOLEAN = 3;
    Node.POINTER = 4;

    // Program, procedure, or function declaration.
    //     name: name of program, procedure, or function (identifier).
    //     declarations: functions, procedures, var, const, uses, etc.
    //     block: block.
    Node.PROGRAM = 10;
    Node.PROCEDURE = 11;
    Node.FUNCTION = 12;

    // Uses declaration.
    //     name: module name (identifier).
    Node.USES = 13;

    // Var declaration.
    //     name: variable name (identifier).
    //     type: variable type.
    Node.VAR = 14;

    // Range of ordinals.
    //     low: lowest index (number).
    //     high: highest index (number).
    Node.RANGE = 15;

    // Begin/end block.
    //     statements: statements.
    Node.BLOCK = 16;

    // Function and procedure parameter.
    //     name: parameter name (identifier).
    //     type: type.
    //     byReference: whether this parameter is by reference.
    Node.PARAMETER = 17;

    // Cast expression to type.
    //     type: destination type.
    //     expression: source node.
    Node.CAST = 18;

    // Constant declaration.
    //     name: variable name (identifier).
    //     type: type.
    //     value: value.
    Node.CONST = 19;

    // Assignment.
    //     lhs: variable being assigned to.
    //     rhs: expression to assign.
    Node.ASSIGNMENT = 20;

    // Procedure call statement.
    //     name: procedure name.
    //     argumentList: procedure arguments.
    Node.PROCEDURE_CALL = 21;

    // Repeat/until.
    //     block: block.
    //     expression: expression.
    Node.REPEAT = 22;

    // For loop.
    //     variable: variable (identifier).
    //     fromExpr: from expression.
    //     toExpr: to expression.
    //     body: body statement.
    //     downto: whether it's a downto loop (true) or to (false).
    Node.FOR = 23;

    // If.
    //     expression: expression.
    //     thenStatement: then statement.
    //     elseStatement: else statement or null.
    Node.IF = 24;

    // Exit.
    //     No additional fields.
    Node.EXIT = 25;

    // Record field.
    //     name: field name (identifier).
    //     type: type.
    //     offset: integer offset from base of record.
    Node.FIELD = 26;

    // While loop.
    //     expression: expression.
    //     statement: statement to loop.
    Node.WHILE = 27;

    // Typed constant. These are really pre-initialized variables.
    //     name: constant name (identifier).
    //     type: declared type.
    //     rawData: a RawData object.
    Node.TYPED_CONST = 28;

    // Unary operators.
    //     expression: expression to act on.
    Node.NOT = 30;
    Node.NEGATIVE = 31;

    // Binary operators. Children are lhs and rhs.
    Node.ADDITION = 40;
    Node.SUBTRACTION = 41;
    Node.MULTIPLICATION = 42;
    Node.DIVISION = 43;
    Node.EQUALITY = 44;
    Node.INEQUALITY = 45;
    Node.LESS_THAN = 46;
    Node.GREATER_THAN = 47;
    Node.LESS_THAN_OR_EQUAL_TO = 48;
    Node.GREATER_THAN_OR_EQUAL_TO = 49;
    Node.AND = 50;
    Node.OR = 51;
    Node.INTEGER_DIVISION = 52;
    Node.MOD = 53;

    // Field designator (expression.fieldName).
    //     variable: the part before the dot, which evaluates to a record type.
    //     field: designated field (FIELD).
    Node.FIELD_DESIGNATOR = 54;

    // Function call expression.
    //     name: function name (identifier).
    //     argumentList: arguments (expressions).
    Node.FUNCTION_CALL = 60;

    // Array dereference.
    //     variable: expression that evaluates to an array.
    //     indices: expression for each index.
    Node.ARRAY = 61;

    // Type definition.
    //     name: name of new type (identifier).
    //     type: aliased type.
    Node.TYPE = 62;

    // Address-of (@) operator.
    //     variable: variable to take the address of.
    Node.ADDRESS_OF = 63

    // Dereference of a pointer (^).
    //     variable: variable to dereference.
    Node.DEREFERENCE = 64;

    // Simple type.
    //     typeCode: one of inst.A, inst.B, inst.C, inst.I, inst.R, or inst.S.
    //     typeName: (inst.A only) name of the type being pointed to. This must be a name
    //         and not a type because we can point to ourselves or have
    //         mutually-referring types.
    //     type: (inst.A only) type being pointed to. This can initially be null, but is
    //         filled in once we have enough types to resolve the type name.
    Node.SIMPLE_TYPE = 70;

    // Enumerated type.
    //     entries: each entry (identifier).
    Node.ENUM_TYPE = 71;

    // Record type.
    //     fields: FIELD nodes.
    Node.RECORD_TYPE = 73;

    // Array type.
    //     elementType: element type.
    //     ranges: RANGE nodes.
    Node.ARRAY_TYPE = 74;

    // Set type.
    //     type: type of element (integral SIMPLE_TYPE or ENUM_TYPE).
    //     range: optional RANGE node.
    Node.SET_TYPE = 75;

    // Procedure, function, or program type.
    //     parameters: parameters (Node.PARAMETER).
    //     returnType: return type (SIMPLE_TYPE inst.P if not function).
    Node.SUBPROGRAM_TYPE = 76;

    // Set the symbol table for this program, procedure, or function.
    Node.prototype.setSymbolTable = function (symbolTable) {
        this.symbolTable = symbolTable;
    };

    // Logs the node in JSON format to the console.
    Node.prototype.log = function () {
        console.log(JSON.stringify(this, null, 4));
    };

    // Returns whether the type is numeric (integer, character, or real).
    Node.prototype.isNumericType = function () {
        return this !== null &&
            this.nodeType === Node.SIMPLE_TYPE &&
            (this.typeCode == inst.C ||
             this.typeCode == inst.I ||
             this.typeCode == inst.R);
    };

    // Returns whether the type is boolean.
    Node.prototype.isBooleanType = function () {
        return this !== null &&
            this.nodeType === Node.SIMPLE_TYPE &&
            this.typeCode == inst.B;
    };

    // Returns whether the type is void (procedure return type).
    Node.prototype.isVoidType = function () {
        return this !== null &&
            this.nodeType === Node.SIMPLE_TYPE &&
            this.typeCode == inst.P;
    };

    // If both are identifiers, and are the same identifier (case-insensitive), returns true.
    // If identifiers and not equal, returns false. If either is not an identifier, throws.
    Node.prototype.isSameIdentifier = function (other) {
        if (this.nodeType !== Node.IDENTIFIER || other.nodeType !== Node.IDENTIFIER) {
            throw new PascalError(this.token, "not an identifier");
        }
        return this.token.value.toLowerCase() === other.token.value.toLowerCase();
    };

    // Given a type, returns true if it's a simple type and of the specified type code.
    Node.prototype.isSimpleType = function (typeCode) {
        return this.nodeType === Node.SIMPLE_TYPE && this.typeCode === typeCode;
    };

    // Given a NUMBER node, returns the value as a float.
    Node.prototype.getNumber = function () {
        if (this.nodeType === Node.NUMBER) {
            return parseFloat(this.token.value);
        } else {
            throw new PascalError(this.token, "expected a number");
        }
    };

    // Given a BOOLEAN node, returns the value as a boolean.
    Node.prototype.getBoolean = function () {
        if (this.nodeType === Node.BOOLEAN) {
            return this.token.value.toLowerCase() === "true";
        } else {
            throw new PascalError(this.token, "expected a boolean");
        }
    };

    // Given a SIMPLE_TYPE node, returns the type code.
    Node.prototype.getSimpleTypeCode = function () {
        if (this.nodeType === Node.SIMPLE_TYPE) {
            return this.typeCode;
        } else {
            throw new PascalError(this.token, "expected a simple type");
        }
    };

    // Given a RANGE node, returns the lower bound as a number.
    Node.prototype.getRangeLowBound = function () {
        if (this.nodeType === Node.RANGE) {
            return this.low.getNumber();
        } else {
            throw new PascalError(this.token, "expected a range");
        }
    };

    // Given a RANGE node, returns the high bound as a number.
    Node.prototype.getRangeHighBound = function () {
        if (this.nodeType === Node.RANGE) {
            return this.high.getNumber();
        } else {
            throw new PascalError(this.token, "expected a range");
        }
    };

    // Given a RANGE node, returns the size (high minus low plus 1).
    Node.prototype.getRangeSize = function () {
        if (this.nodeType === Node.RANGE) {
            return this.high.getNumber() - this.low.getNumber() + 1;
        } else {
            throw new PascalError(this.token, "expected a range");
        }
    };

    // Given a RECORD_TYPE node, returns the FIELD node for the given token.
    Node.prototype.getField = function (fieldToken) {
        if (this.nodeType !== Node.RECORD_TYPE) {
            throw new PascalError(this.token, "expected a record");
        }

        if (fieldToken.tokenType !== Token.IDENTIFIER) {
            throw new PascalError(fieldToken, "expected a field name");
        }

        // We could use a dictionary for this instead of a linear lookup, but
        // it's not worth the complexity.
        for (var i = 0; i < this.fields.length; i++) {
            var field = this.fields[i];
            if (field.name.token.isEqualTo(fieldToken)) {
                return field;
            }
        }

        throw new PascalError(fieldToken, "field not found in record");
    };

    // Given any expression type, returns the value of the expression. The
    // expression must evaluate to a scalar constant.
    Node.prototype.getConstantValue = function () {
        switch (this.nodeType) {
            case Node.NUMBER:
                return this.getNumber();
            case Node.BOOLEAN:
                return this.getBoolean();
            case Node.STRING:
                return this.token.value;
            default:
                throw new PascalError(this.token, "cannot get constant value of node type " +
                                      this.nodeType);
        }
    };

    // Return the total parameter size of a function's parameters.
    Node.prototype.getTotalParameterSize = function () {
        if (this.nodeType !== Node.SUBPROGRAM_TYPE) {
            throw new PascalError(this.token, "can't get parameter size of non-subprogram");
        }

        var size = 0;

        for (var i = 0; i < this.parameters.length; i++) {
            var parameter = this.parameters[i];
            size += parameter.byReference ? 1 : parameter.type.getTypeSize();
        }

        return size;
    };

    // Given a type node (SIMPLE_TYPE, ARRAY_TYPE, etc.), returns the size of that type.
    Node.prototype.getTypeSize = function () {
        var size;

        switch (this.nodeType) {
            case Node.SIMPLE_TYPE:
                // They all have the same size.
                size = 1;
                break;
            /// case Node.ENUM_TYPE:
            case Node.RECORD_TYPE:
                size = 0;
                for (var i = 0; i < this.fields.length; i++) {
                    size += this.fields[i].type.getTypeSize();
                }
                break;
            case Node.ARRAY_TYPE:
                // Start with size of element type.
                size = this.elementType.getTypeSize();

                // Multiply each range size.
                for (var i = 0; i < this.ranges.length; i++) {
                    size *= this.ranges[i].getRangeSize();
                }
                break;
            /// case Node.SET_TYPE:
            default:
                throw new PascalError(this.token, "can't get size of type " + this.print());
        }

        return size;
    };

    // Useful types.
    Node.pointerType = new Node(Node.SIMPLE_TYPE, null, {typeCode: inst.A});
    Node.booleanType = new Node(Node.SIMPLE_TYPE, null, {typeCode: inst.B});
    Node.charType = new Node(Node.SIMPLE_TYPE, null, {typeCode: inst.C});
    Node.integerType = new Node(Node.SIMPLE_TYPE, null, {typeCode: inst.I});
    Node.voidType = new Node(Node.SIMPLE_TYPE, null, {typeCode: inst.P});
    Node.realType = new Node(Node.SIMPLE_TYPE, null, {typeCode: inst.R});
    Node.stringType = new Node(Node.SIMPLE_TYPE, null, {typeCode: inst.S});

    // Fluid method to set the expression type.
    Node.prototype.withExpressionType = function (expressionType) {
        this.expressionType = expressionType;
        return this;
    };
    Node.prototype.withExpressionTypeFrom = function (node) {
        this.expressionType = node.expressionType;
        return this;
    };

    // Useful methods.
    Node.makeIdentifierNode = function (name) {
        return new Node(Node.IDENTIFIER, new Token(name, Token.IDENTIFIER));
    };
    Node.makeNumberNode = function (value) {
        return new Node(Node.NUMBER, new Token("" + value, Token.NUMBER));
    };
    Node.makeBooleanNode = function (value) {
        return new Node(Node.BOOLEAN, new Token(value ? "True" : "False", Token.IDENTIFIER));
    };
    Node.makePointerNode = function (value) {
        // Nil is the only constant pointer.
        if (value !== null) {
            throw new PascalError(null, "nil is the only pointer constant");
        }
        return new Node(Node.POINTER, new Token("Nil", Token.IDENTIFIER));
    };

    // Maps a node type (e.g., Node.PROGRAM) to a string ("program", "procedure", or "function").
    Node.nodeLabel = {}; // Filled below.

    // Returns printed version of node.
    Node.prototype.print = function (indent) {
        var s = "";

        // Allow caller to not set indent.
        indent = indent || "";

        switch (this.nodeType) {
            case Node.IDENTIFIER:
            case Node.NUMBER:
            case Node.BOOLEAN:
            case Node.POINTER:
                s += this.token.value;
                break;
            case Node.STRING:
                s += "'" + this.token.value + "'";
                break;
            case Node.PROGRAM:
            case Node.PROCEDURE:
            case Node.FUNCTION:
                // Nest procedures and functions.
                if (this.nodeType !== Node.PROGRAM) {
                    indent += "    ";
                    s += "\n";
                }

                s += indent + Node.nodeLabel[this.nodeType] + " " + this.name.token.value;

                // Print parameters and return type.
                s += this.expressionType.print() + ";\n\n";

                // Declarations.
                for (var i = 0; i < this.declarations.length; i++) {
                    s += this.declarations[i].print(indent) + ";\n";
                }

                // Main block.
                s += "\n" + this.block.print(indent);

                if (this.nodeType === Node.PROGRAM) {
                    s += ".\n";
                }
                break;
            case Node.USES:
                s += indent + "uses " + this.name.token.value;
                break;
            case Node.VAR:
                s += indent + "var " + this.name.print() + " : " + this.type.print();
                break;
            case Node.RANGE:
                s += this.low.print() + ".." + this.high.print();
                break;
            case Node.BLOCK:
                s += indent + "begin\n";
                for (var i = 0; i < this.statements.length; i++) {
                    s += this.statements[i].print(indent + "    ") + ";\n";
                }
                s += indent + "end";
                break;
            case Node.PARAMETER:
                s += (this.byReference ? "var " : "") + this.name.print() +
                    " : " + this.type.print();
                break;
            case Node.CAST:
                s += this.type.print() + "(" + this.expression.print() + ")";
                break;
            case Node.CONST:
                s += indent + "const " + this.name.print();
                if (this.type !== null) {
                    s += " { : " + this.type.print() + " }";
                }
                s += " = " + this.value.print();
                break;
            case Node.ASSIGNMENT:
                s += indent + this.lhs.print() + " := " + this.rhs.print();
                break;
            case Node.PROCEDURE_CALL:
            case Node.FUNCTION_CALL:
                if (this.nodeType === Node.PROCEDURE_CALL) {
                    s += indent;
                }
                s += this.name.print();
                var argumentList = [];
                for (var i = 0; i < this.argumentList.length; i++) {
                    argumentList.push(this.argumentList[i].print(indent));
                }
                if (argumentList.length > 0) {
                    s += "(" + argumentList.join(", ") + ")";
                }
                break;
            case Node.REPEAT:
                s += indent + "repeat\n";
                s += this.block.print(indent + "    ");
                s += "\n" + indent + "until " + this.expression.print();
                break;
            case Node.FOR:
                s += indent + "for " + this.variable.print() + " := " +
                    this.fromExpr.print() + (this.downto ? " downto " : " to ") +
                    this.toExpr.print() +
                    " do\n";
                s += this.body.print(indent + "    ");
                break;
            case Node.IF:
                s += indent + "if " + this.expression.print() + " then\n";
                s += this.thenStatement.print(indent + "    ");
                if (this.elseStatement) {
                    s += "\n" + indent + "else\n";
                    s += this.elseStatement.print(indent + "    ");
                }
                break;
            case Node.EXIT:
                s += indent + "Exit";
                break;
            case Node.FIELD:
                s += indent + this.name.print() + " : " + this.type.print(indent);
                break;
            case Node.WHILE:
                s += indent + "while " + this.expression.print() + " do\n" +
                    this.statement.print(indent + "    ");
                break;
            case Node.TYPED_CONST:
                s += indent + "const " + this.name.print();
                s += " : " + this.type.print();
                s += " = " + this.rawData.print();
                break;
            case Node.NOT:
                s += "Not " + this.expression.print();
                break;
            case Node.NEGATIVE:
                s += "-" + this.expression.print();
                break;
            case Node.ADDITION:
                s += this.lhs.print() + " + " + this.rhs.print();
                break;
            case Node.SUBTRACTION:
                s += this.lhs.print() + " - " + this.rhs.print();
                break;
            case Node.MULTIPLICATION:
                s += "(" + this.lhs.print() + "*" + this.rhs.print() + ")";
                break;
            case Node.DIVISION:
                s += this.lhs.print() + "/" + this.rhs.print();
                break;
            case Node.EQUALITY:
                s += this.lhs.print() + " = " + this.rhs.print();
                break;
            case Node.INEQUALITY:
                s += this.lhs.print() + " <> " + this.rhs.print();
                break;
            case Node.LESS_THAN:
                s += this.lhs.print() + " < " + this.rhs.print();
                break;
            case Node.GREATER_THAN:
                s += this.lhs.print() + " > " + this.rhs.print();
                break;
            case Node.LESS_THAN_OR_EQUAL_TO:
                s += this.lhs.print() + " <= " + this.rhs.print();
                break;
            case Node.GREATER_THAN_OR_EQUAL_TO:
                s += this.lhs.print() + " >= " + this.rhs.print();
                break;
            case Node.AND:
                s += this.lhs.print() + " and " + this.rhs.print();
                break;
            case Node.OR:
                s += this.lhs.print() + " or " + this.rhs.print();
                break;
            case Node.INTEGER_DIVISION:
                s += this.lhs.print() + " div " + this.rhs.print();
                break;
            case Node.MOD:
                s += this.lhs.print() + " mod " + this.rhs.print();
                break;
            case Node.FIELD_DESIGNATOR:
                s += this.variable.print() + "." + this.field.name.print();
                break;
            case Node.ARRAY:
                var indices = [];
                for (var i = 0; i < this.indices.length; i++) {
                    indices.push(this.indices[i].print());
                }
                s += this.variable.print() + "[" + indices.join(",") + "]";
                break;
            case Node.TYPE:
                s += indent + "type " + this.name.print() + " = " + this.type.print();
                break;
            case Node.ADDRESS_OF:
                s += "@" + this.variable.print();
                break;
            case Node.DEREFERENCE:
                s += this.variable.print() + "^";
                break;
            case Node.SIMPLE_TYPE:
                if (this.typeCode === inst.A) {
                    if (this.typeName) {
                        s += "^" + this.typeName.print();
                    } else {
                        // Generic pointer.
                        s += "Pointer";
                    }
                } else {
                    s += inst.typeCodeToName(this.typeCode);
                }
                break;
            case Node.RECORD_TYPE:
                s += "record\n";
                for (var i = 0; i < this.fields.length; i++) {
                    s += this.fields[i].print(indent + "    ") + ";\n";
                }
                s += indent + "end";
                break;
            case Node.ARRAY_TYPE:
                var ranges = [];
                for (var i = 0; i < this.ranges.length; i++) {
                    ranges.push(this.ranges[i].print());
                }
                s += "array[" + ranges.join(",") + "] of " + this.elementType.print();
                break;
            case Node.SUBPROGRAM_TYPE:
                // Print parameters.
                var parameters = [];
                for (var i = 0; i < this.parameters.length; i++) {
                    parameters.push(this.parameters[i].print());
                }
                if (parameters.length > 0) {
                    s += "(" + parameters.join("; ") + ")";
                }

                // Functions only: return type.
                if (!this.returnType.isSimpleType(inst.P)) {
                    s += " : " + this.returnType.print();
                }
                break;
            default:
                s = "<UNKNOWN>";
                break;
        }

        return s;
    };

    // Return a node that casts "this" to "type". Returns "this" if it's already
    // of type "type". Throws if "this" can't be cast to "type".
    Node.prototype.castToType = function (type) {
        // If the destination type is void and we're by reference, then do nothing
        // and allow anything. We're essentially passing into an untyped "var foo"
        // parameter.
        if (type.isVoidType() && this.byReference) {
            return this;
        }

        // Existing type.
        var nodeType = this.expressionType;

        // Must have type defined.
        if (!type) {
            throw new PascalError(this.token, "can't cast to null type");
        }
        if (!nodeType) {
            throw new PascalError(this.token, "can't cast from null type");
        }

        // Must be the same type of node. Can't cast between node types
        // (e.g., array to set).
        if (type.nodeType !== nodeType.nodeType) {
            throw new PascalError(this.token, "can't cast from " + nodeType.nodeType +
                                 " to " + type.nodeType);
        }

        // Can cast between some simple types.
        if (type.nodeType === Node.SIMPLE_TYPE) {
            if (type.typeCode !== nodeType.typeCode) {
                // They're different simple types.
                var typeCode = type.typeCode;         // To Type
                var nodeTypeCode = nodeType.typeCode; // From Type

                if (typeCode === inst.A || nodeTypeCode === inst.A ||
                    typeCode === inst.B || nodeTypeCode === inst.B ||
                    typeCode === inst.T || nodeTypeCode === inst.T ||
                    typeCode === inst.P || nodeTypeCode === inst.P ||
                    typeCode === inst.X || nodeTypeCode === inst.X) {

                    // These can't be cast.
                    throw new PascalError(this.token, "can't cast from " +
                                         inst.typeCodeToName(nodeTypeCode) +
                                         " to " + inst.typeCodeToName(typeCode));
                }

                // Cast Char to String, just return the same node.
                if (typeCode === inst.S && nodeTypeCode === inst.C) {
                    return this;
                }

                // Can always cast to a real.
                if (typeCode === inst.R ||
                    (typeCode === inst.I && nodeTypeCode !== inst.R)) {

                    var node = new Node(Node.CAST, type.token, {
                        type: type,
                        expression: this
                    });
                    node.expressionType = type;
                    return node;
                }

                // Can't cast.
                throw new PascalError(this.token, "can't cast from " +
                                     inst.typeCodeToName(nodeTypeCode) +
                                     " to " + inst.typeCodeToName(typeCode));
            } else {
                // Same simple typeCode. If they're pointers, then they
                // must be compatible types or the source must be nil.
                if (type.typeCode === inst.A) {
                    if (!nodeType.typeName) {
                        // Assigning from Nil, always allowed.
                    } else if (!type.typeName) {
                        // Assigning to generic pointer, always allowed.
                    } else if (type.typeName.isSameIdentifier(nodeType.typeName)) {
                        // Same pointer type.
                    } else {
                        // Incompatible pointers, disallow. XXX test this.
                        throw new PascalError(this.token, "can't cast from pointer to " +
                                              nodeType.print() + " to pointer to " + type.print());
                    }
                }
            }
        } else {
            // Complex type. XXX We should verify that they're of the same type.
        }

        // Nothing to cast, return existing node.
        return this;
    };

    // Fill in this label map.
    Node.nodeLabel[Node.PROGRAM] = "program";
    Node.nodeLabel[Node.PROCEDURE] = "procedure";
    Node.nodeLabel[Node.FUNCTION] = "function";

    return Node;
});
