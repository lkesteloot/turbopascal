// A table of symbols, where each symbol can be a variable, procedure, or
// function. A table is for a lexical scope only, but has a link to the
// lexical scope it's nested in.

'use strict';

define(["PascalError", "Symbol", "Node", "Token", "modules",
       "inst", "Native", "NativeProcedure", "SymbolLookup", "underscore"],
       function (PascalError, Symbol, Node, Token, modules,
                 inst, Native, NativeProcedure, SymbolLookup, _) {

    // The parent symbol table must be lexical, not dynamic.
    var SymbolTable = function (parentSymbolTable) {
        // Map from symbol name (all lowercase, since Pascal is case-insensitive) to
        // a Symbol object. This stores variables, constants, procedure, and functions.
        // Basically any symbol that can be references in an expression.
        this.symbols = {};

        // Map from type name (all lowercase, since Pascal is case-insensitive) to
        // a Symbol object. This stores user-defined types.
        this.types = {};

        // Parent of this table. Symbols not found in this table are looked up in the
        // parent one if it's not null.
        this.parentSymbolTable = parentSymbolTable;

        // Registry of native functions. We only have one of these, so if we have a parent,
        // use its object.
        this.native = parentSymbolTable ? parentSymbolTable.native : new Native();

        // Size (in words) of all variables in this frame.
        this.totalVariableSize = 0;

        // Size (in words) of all parameters in this frame.
        this.totalParameterSize = 0;

        // Size (in words) of all typed constants in this frame.
        this.totalTypedConstantsSize = 0;
    };

    // Adds a symbol to the table. Returns the Symbol object.
    SymbolTable.prototype.addSymbol = function (name, nodeType, type, byReference) {
        var address = -1; // Indicates error.

        // Default to false.
        byReference = byReference || false;

        if (nodeType === Node.VAR) {
            // For this to work, all parameters must be added to the symbol table
            // before any variable is added.
            address = inst.MARK_SIZE + this.totalParameterSize + this.totalVariableSize;
            this.totalVariableSize += type.getTypeSize();
        } else if (nodeType === Node.CONST) {
            // Nothing. We may later treat constant arrays like read-only
            // variables, in the sense that they end up on the stack. I don't
            // know how we'd populate them. I think in the real p-machine they
            // end up above the heap and are loaded declaratively from the
            // bytecode object.
        } else if (nodeType === Node.TYPED_CONST) {
            // They end up being copied to the stack at the start of
            // a function call, like a regular variable.
            address = inst.MARK_SIZE + this.totalParameterSize + this.totalVariableSize;
            this.totalVariableSize += type.getTypeSize();
        } else if (nodeType === Node.PARAMETER) {
            address = inst.MARK_SIZE + this.totalParameterSize;
            this.totalParameterSize += byReference ? 1 : type.getTypeSize();
        }

        var symbol = new Symbol(name, type, address, byReference);
        this.symbols[name.toLowerCase()] = symbol;

        return symbol;
    };

    // Add a user-defined type, returning the Symbol object.
    SymbolTable.prototype.addType = function (name, type) {
        var symbol = new Symbol(name, type, 0, false);
        this.types[name.toLowerCase()] = symbol;

        return symbol;
    };

    // Returns the SymbolLookup object for the name. If the name is not found
    // in this table, the parent table is consulted if it's set. Throws if not
    // found. The nodeType is optional. If set, only nodes of that type will
    // be returned. The "level" parameter is for internal use and should be left out.
    SymbolTable.prototype.getSymbol = function (token, nodeType, level) {
        var name = token.value.toLowerCase();

        // Default to zero.
        level = level || 0;

        if (this.symbols.hasOwnProperty(name)) {
            var symbol = this.symbols[name];

            // Match optional nodeType.
            if (!nodeType || symbol.type.nodeType === nodeType) {
                return new SymbolLookup(symbol, level);
            }
        }

        if (this.parentSymbolTable !== null) {
            return this.parentSymbolTable.getSymbol(token, nodeType, level + 1);
        }

        throw new PascalError(token, "can't find symbol");
    };

    // Returns a SymbolLookup object for the type name. If the name is not
    // found in this table, the parent table is consulted if it's set. Throws
    // if not found. The "level" parameter is for internal use and should be left out.
    SymbolTable.prototype.getType = function (token, level) {
        var name = token.value.toLowerCase();

        // Default to zero.
        level = level || 0;

        if (this.types.hasOwnProperty(name)) {
            var symbol = this.types[name];
            return new SymbolLookup(symbol, level);
        }

        if (this.parentSymbolTable !== null) {
            return this.parentSymbolTable.getType(token, level + 1);
        }

        throw new PascalError(token, "unknown type");
    };

    // Add a native constant to the symbol table.
    SymbolTable.prototype.addNativeConstant = function (name, value, type) {
        var valueNode;
        switch (type.getSimpleTypeCode()) {
            case inst.A:
                valueNode = Node.makePointerNode(value);
                break;
            case inst.B:
                valueNode = Node.makeBooleanNode(value);
                break;
            default:
                valueNode = Node.makeNumberNode(value);
                break;
        }
        valueNode.expressionType = type;

        var symbol = this.addSymbol(name, Node.CONST, type);
        symbol.value = valueNode;
    };

    // Add a native function to the symbol table.
    SymbolTable.prototype.addNativeFunction = function (name, returnType, parameterTypes, fn) {
        // Add to table of builtins first (for CSP call).
        var nativeProcedure = new NativeProcedure(name, returnType, parameterTypes, fn);
        var index = this.native.add(nativeProcedure);

        // Function that takes a type and an index and returns a PARAMETER for it.
        var makeParameter = function (type, index) {
            var name = Node.makeIdentifierNode(String.fromCharCode(97 + index)); // "a", "b", ...
            return new Node(Node.PARAMETER, null, {
                name: name,
                type: type
            });
        };

        // Make function type.
        var type = new Node(Node.SUBPROGRAM_TYPE, null, {
            parameters: _.map(parameterTypes, makeParameter),
            returnType: returnType
        });

        // Add to this symbol table.
        var symbol = this.addSymbol(name, Node.SUBPROGRAM_TYPE, type);

        // Remember the native index.
        symbol.address = index;

        // Mark it as native.
        symbol.isNative = true;

        return symbol;
    };

    // Add a native type (such as "integer") to the symbol table.
    SymbolTable.prototype.addNativeType = function (name, type) {
        // Nothing special here, it's just like a user-defined type.
        this.addType(name, type);
    };

    // Create a default symbol table with all built-in symbols.
    SymbolTable.makeBuiltinSymbolTable = function () {
        var symbolTable = new SymbolTable(null);

        modules.importModule("__builtin__", symbolTable);

        return symbolTable;
    };

    return SymbolTable;
});
