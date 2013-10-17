// Compiler from parse tree to bytecode.

'use strict';

define(["Bytecode", "Node", "inst", "PascalError"],
       function (Bytecode, Node, inst, PascalError) {

    var Compiler = function () {
        // This is a stack of lists of addresses of unconditional jumps (UJP) instructions
        // that should go to the end of the function/procedure in an Exit statement.
        // Each outer element represents a nested function/procedure we're compiling.
        // The inner list is an unordered list of addresses to update when we get to
        // the end of the function/procedure and know its last address.
        this.exitInstructions = [];
    };

    // Given a parse tree, return the bytecode object.
    Compiler.prototype.compile = function (root) {
        var bytecode = new Bytecode(root.symbolTable.native);

        // Start at the root and recurse.
        this._generateBytecode(bytecode, root, null);

        // Generate top-level calling code.
        bytecode.setStartAddress();
        bytecode.add(inst.MST, 0, 0, "start of program -----------------");
        bytecode.add(inst.CUP, 0, root.symbol.address, "call main program");
        bytecode.add(inst.STP, 0, 0, "program end");

        return bytecode;
    };

    // Adds the node to the bytecode.
    Compiler.prototype._generateBytecode = function (bytecode, node, symbolTable) {
        switch (node.nodeType) {
            case Node.IDENTIFIER:
                var name = node.token.value;
                var symbolLookup = node.symbolLookup;
                if (symbolLookup.symbol.byReference) {
                    // Symbol is by reference. Must get its address first.
                    bytecode.add(inst.LVA, symbolLookup.level,
                                 symbolLookup.symbol.address, "address of " + name);
                    bytecode.add(inst.LDI, symbolLookup.symbol.type.typeCode,
                                 0, "value of " + name);
                } else {
                    // Here we could call _generateAddressBytecode() followed by an inst.LDI,
                    // but loading the value directly is more efficient.
                    if (symbolLookup.symbol.type.nodeType === Node.SIMPLE_TYPE) {
                        var opcode;
                        switch (symbolLookup.symbol.type.typeCode) {
                            case inst.A:
                                opcode = inst.LVA;
                                break;
                            case inst.B:
                                opcode = inst.LVB;
                                break;
                            case inst.C:
                                opcode = inst.LVC;
                                break;
                            case inst.I:
                                opcode = inst.LVI;
                                break;
                            case inst.R:
                                opcode = inst.LVR;
                                break;
                            default:
                                throw new PascalError(node.token, "can't make code to get " +
                                                     symbolLookup.symbol.type.print());
                        }
                        bytecode.add(opcode, symbolLookup.level,
                                     symbolLookup.symbol.address, "value of " + name);
                    } else {
                        // This is a more complex type, and apparently it's being
                        // passed by value, so we push the entire thing onto the stack.
                        var size = symbolLookup.symbol.type.getTypeSize();
                        // For large parameters it would be more
                        // space-efficient (but slower) to have a loop.
                        for (var i = 0; i < size; i++) {
                            bytecode.add(inst.LVI, symbolLookup.level,
                                         symbolLookup.symbol.address + i,
                                         "value of " + name + " at index " + i);
                        }
                    }
                }
                break;
            case Node.NUMBER:
                var v = node.getNumber();
                var cindex = bytecode.addConstant(v);

                // See if we're an integer or real.
                var typeCode;
                if ((v | 0) === v) {
                    typeCode = inst.I;
                } else {
                    typeCode = inst.R;
                }

                bytecode.add(inst.LDC, typeCode, cindex, "constant value " + v);
                break;
            case Node.STRING:
                var v = node.token.value;
                var cindex = bytecode.addConstant(v);
                bytecode.add(inst.LDC, inst.S, cindex, "string '" + v + "'");
                break;
            case Node.BOOLEAN:
                var v = node.token.value;
                bytecode.add(inst.LDC, inst.B, node.getBoolean() ? 1 : 0, "boolean " + v);
                break;
            case Node.POINTER:
                // This can only be nil.
                var cindex = bytecode.addConstant(0);
                bytecode.add(inst.LDC, inst.A, cindex, "nil pointer");
                break;
            case Node.PROGRAM:
            case Node.PROCEDURE:
            case Node.FUNCTION:
                var isFunction = node.nodeType === Node.FUNCTION;
                var name = node.name.token.value;

                // Begin a new frame for exit statements.
                this._beginExitFrame();

                // Generate each procedure and function.
                for (var i = 0; i < node.declarations.length; i++) {
                    var declaration = node.declarations[i];
                    if (declaration.nodeType === Node.PROCEDURE ||
                        declaration.nodeType === Node.FUNCTION) {

                        this._generateBytecode(bytecode, declaration, node.symbolTable);
                    }
                }

                // Generate code for entry to block.
                node.symbol.address = bytecode.getNextAddress();
                var frameSize = inst.MARK_SIZE + node.symbolTable.totalVariableSize +
                    node.symbolTable.totalParameterSize;
                bytecode.add(inst.ENT, 0, frameSize, "start of " + name + " -----------------");

                // Generate code for typed constants.
                for (var i = 0; i < node.declarations.length; i++) {
                    var declaration = node.declarations[i];
                    if (declaration.nodeType === Node.TYPED_CONST) {
                        this._generateBytecode(bytecode, declaration, node.symbolTable);
                    }
                }

                // Generate code for block.
                this._generateBytecode(bytecode, node.block, node.symbolTable);

                // End the frame for exit statements.
                var ujpAddresses = this._endExitFrame();
                var rtnAddress = bytecode.getNextAddress();

                bytecode.add(inst.RTN, isFunction ? node.expressionType.
                             returnType.getSimpleTypeCode() : inst.P, 0, "end of " + name);

                // Update all of the UJP statements to point to RTN.
                for (var i = 0; i < ujpAddresses.length; i++) {
                    bytecode.setOperand2(ujpAddresses[i], rtnAddress);
                }
                break;
            case Node.USES:
            case Node.VAR:
            case Node.PARAMETER:
            case Node.CONST:
            case Node.ARRAY_TYPE:
            case Node.TYPE:
                // Nothing.
                break;
            case Node.BLOCK:
                for (var i = 0; i < node.statements.length; i++) {
                    this._generateBytecode(bytecode, node.statements[i], symbolTable);
                }
                break;
            case Node.CAST:
                this._generateBytecode(bytecode, node.expression, symbolTable);
                var fromType = node.expression.expressionType;
                var toType = node.type;
                if (fromType.isSimpleType(inst.I) && toType.isSimpleType(inst.R)) {
                    bytecode.add(inst.FLT, 0, 0, "cast to float");
                } else {
                    throw new PascalError(node.token, "don't know how to compile a cast from " +
                                         fromType.print() + " to " + toType.print());
                }
                break;
            case Node.ASSIGNMENT:
                // Push address of LHS onto stack.
                this._generateAddressBytecode(bytecode, node.lhs, symbolTable);

                // Push RHS onto stack.
                this._generateBytecode(bytecode, node.rhs, symbolTable);

                // We don't look at the type code when executing, but might as
                // well set it anyway.
                var storeTypeCode = node.rhs.expressionType.getSimpleTypeCode();

                bytecode.add(inst.STI, storeTypeCode, 0, "store into " + node.lhs.print());
                break;
            case Node.PROCEDURE_CALL:
            case Node.FUNCTION_CALL:
                var isFunction = node.nodeType === Node.FUNCTION_CALL;
                var declType = isFunction ? "function" : "procedure";
                var symbolLookup = node.name.symbolLookup;
                var symbol = symbolLookup.symbol;

                if (!symbol.isNative) {
                    bytecode.add(inst.MST, symbolLookup.level, 0, "set up mark for " + declType);
                }

                // Push arguments.
                for (var i = 0; i < node.argumentList.length; i++) {
                    var argument = node.argumentList[i];
                    if (argument.byReference) {
                        this._generateAddressBytecode(bytecode, argument, symbolTable);
                    } else {
                        this._generateBytecode(bytecode, argument, symbolTable);
                    }
                }

                // See if this is a user procedure/function or native procedure/function.
                if (symbol.isNative) {
                    // The CSP index is stored in the address field.
                    var index = symbol.address;
                    bytecode.add(inst.CSP, node.argumentList.length, index,
                                 "call system " + declType + " " + symbol.name);
                } else {
                    // Call procedure/function.
                    var parameterSize = symbol.type.getTotalParameterSize();
                    bytecode.add(inst.CUP, parameterSize, symbol.address,
                                 "call " + node.name.print());
                }
                break;
            case Node.REPEAT:
                var topOfLoop = bytecode.getNextAddress();
                bytecode.addComment(topOfLoop, "top of repeat loop");
                this._generateBytecode(bytecode, node.block, symbolTable);
                this._generateBytecode(bytecode, node.expression, symbolTable);
                bytecode.add(inst.FJP, 0, topOfLoop, "jump to top of repeat");
                break;
            case Node.FOR:
                // Assign start value.
                var varNode = node.variable;
                this._generateAddressBytecode(bytecode, varNode, symbolTable);
                this._generateBytecode(bytecode, node.fromExpr, symbolTable);
                bytecode.add(inst.STI, 0, 0, "store into " + varNode.print());

                // Comparison.
                var topOfLoop = bytecode.getNextAddress();
                this._generateBytecode(bytecode, varNode, symbolTable);
                this._generateBytecode(bytecode, node.toExpr, symbolTable);
                bytecode.add(node.downto ? inst.LES : inst.GRT,
                             inst.I, 0, "see if we're done with the loop");
                var jumpInstruction = bytecode.getNextAddress();
                bytecode.add(inst.TJP, 0, 0, "yes, jump to end");

                // Body.
                this._generateBytecode(bytecode, node.body, symbolTable);

                // Increment/decrement variable.
                this._generateAddressBytecode(bytecode, varNode, symbolTable);
                this._generateBytecode(bytecode, varNode, symbolTable);
                if (node.downto) {
                    bytecode.add(inst.DEC, inst.I, 0, "decrement loop variable");
                } else {
                    bytecode.add(inst.INC, inst.I, 0, "increment loop variable");
                }
                bytecode.add(inst.STI, 0, 0, "store into " + varNode.print());

                // Jump back to top.
                bytecode.add(inst.UJP, 0, topOfLoop, "jump to top of loop");

                var endOfLoop = bytecode.getNextAddress();

                // Fix up earlier jump.
                bytecode.setOperand2(jumpInstruction, endOfLoop);
                break;
            case Node.IF:
                var hasElse = node.elseStatement !== null;

                // Do comparison.
                this._generateBytecode(bytecode, node.expression, symbolTable);
                var skipThenInstruction = bytecode.getNextAddress();
                bytecode.add(inst.FJP, 0, 0, "false, jump " + (hasElse ? "to else" : "past body"));

                // Then block.
                this._generateBytecode(bytecode, node.thenStatement, symbolTable);
                var skipElseInstruction = -1;
                if (hasElse) {
                    skipElseInstruction = bytecode.getNextAddress();
                    bytecode.add(inst.UJP, 0, 0, "jump past else");
                }

                // Else block.
                var falseAddress = bytecode.getNextAddress();
                if (hasElse) {
                    this._generateBytecode(bytecode, node.elseStatement, symbolTable);
                }

                // Fix up earlier jumps.
                bytecode.setOperand2(skipThenInstruction, falseAddress);
                if (hasElse !== -1) {
                    var endOfIf = bytecode.getNextAddress();
                    bytecode.setOperand2(skipElseInstruction, endOfIf);
                }
                break;
            case Node.EXIT:
                // Return from procedure or function. We don't yet have the address
                // of the last instruction in this function, so we keep track of these
                // in an array and deal with them at the end.
                var address = bytecode.getNextAddress();
                bytecode.add(inst.UJP, 0, 0, "return from function/procedure");
                this._addExitInstruction(address);
                break;
            case Node.WHILE:
                // Generate the expression test.
                var topOfLoop = bytecode.getNextAddress();
                bytecode.addComment(topOfLoop, "top of while loop");
                this._generateBytecode(bytecode, node.expression, symbolTable);

                // Jump over the statement if the expression was false.
                var jumpInstruction = bytecode.getNextAddress();
                bytecode.add(inst.FJP, 0, 0, "if false, exit while loop");

                // Generate the statement.
                this._generateBytecode(bytecode, node.statement, symbolTable);
                bytecode.add(inst.UJP, 0, topOfLoop, "jump to top of while loop");

                // Fix up earlier jump.
                var endOfLoop = bytecode.getNextAddress();
                bytecode.setOperand2(jumpInstruction, endOfLoop);
                break;
            case Node.TYPED_CONST:
                // These are just initialized variables. Copy the values to their stack
                // location.
                var constAddress = bytecode.addTypedConstants(node.rawData.data);

                for (var i = 0; i < node.rawData.length; i++) {
                    var typeCode = node.rawData.simpleTypeCodes[i];

                    bytecode.add(inst.LDA, 0, node.symbol.address + i,
                                 "address of " + node.name.print() +
                                 " on stack (element " + i + ")");
                    // It's absurd to create this many constants, one for each
                    // address in the const pool, but I don't see another
                    // straightforward way to do it. Creating an ad-hoc loop is
                    // hard because I don't know where I'd store the loop
                    // variable. Even if I could store it on the stack where we
                    // are, how would I pop it off at the end of the loop? We
                    // don't have a POP instruction.
                    var cindex = bytecode.addConstant(constAddress + i);
                    bytecode.add(inst.LDC, inst.A, cindex, "address of " +
                                 node.name.print() + " in const area (element " + i + ")");
                    bytecode.add(inst.LDI, typeCode, 0, "value of element");
                    bytecode.add(inst.STI, typeCode, 0, "write value");
                }

                break;
            case Node.NOT:
                this._generateBytecode(bytecode, node.expression, symbolTable);
                bytecode.add(inst.NOT, 0, 0, "logical not");
                break;
            case Node.NEGATIVE:
                this._generateBytecode(bytecode, node.expression, symbolTable);
                if (node.expression.expressionType.isSimpleType(inst.R)) {
                    bytecode.add(inst.NGR, 0, 0, "real sign inversion");
                } else {
                    bytecode.add(inst.NGI, 0, 0, "integer sign inversion");
                }
                break;
            case Node.ADDITION:
                this._generateNumericBinaryBytecode(bytecode, node, symbolTable,
                                                    "add", inst.ADI, inst.ADR);
                break;
            case Node.SUBTRACTION:
                this._generateNumericBinaryBytecode(bytecode, node, symbolTable,
                                                    "subtract", inst.SBI, inst.SBR);
                break;
            case Node.MULTIPLICATION:
                this._generateNumericBinaryBytecode(bytecode, node, symbolTable,
                                                    "multiply", inst.MPI, inst.MPR);
                break;
            case Node.DIVISION:
                this._generateNumericBinaryBytecode(bytecode, node, symbolTable,
                                                    "divide", null, inst.DVR);
                break;
            case Node.FIELD_DESIGNATOR:
                this._generateAddressBytecode(bytecode, node, symbolTable);
                bytecode.add(inst.LDI, node.expressionType.getSimpleTypeCode(), 0,
                             "load value of record field");
                break;
            case Node.ARRAY:
                // Array lookup.
                this._generateAddressBytecode(bytecode, node, symbolTable);
                bytecode.add(inst.LDI, node.expressionType.getSimpleTypeCode(), 0,
                             "load value of array element");
                break;
            case Node.ADDRESS_OF:
                this._generateAddressBytecode(bytecode, node.variable, symbolTable);
                break;
            case Node.DEREFERENCE:
                this._generateBytecode(bytecode, node.variable, symbolTable);
                bytecode.add(inst.LDI, node.expressionType.getSimpleTypeCode(), 0,
                             "load value pointed to by pointer");
                break;
            case Node.EQUALITY:
                this._generateComparisonBinaryBytecode(bytecode, node, symbolTable,
                                                       "equals", inst.EQU);
                break;
            case Node.INEQUALITY:
                this._generateComparisonBinaryBytecode(bytecode, node, symbolTable,
                                                       "not equals", inst.NEQ);
                break;
            case Node.LESS_THAN:
                this._generateComparisonBinaryBytecode(bytecode, node, symbolTable,
                                                       "less than", inst.LES);
                break;
            case Node.GREATER_THAN:
                this._generateComparisonBinaryBytecode(bytecode, node, symbolTable,
                                                       "greater than", inst.GRT);
                break;
            case Node.LESS_THAN_OR_EQUAL_TO:
                this._generateComparisonBinaryBytecode(bytecode, node, symbolTable,
                                                       "less than or equal to", inst.LEQ);
                break;
            case Node.GREATER_THAN_OR_EQUAL_TO:
                this._generateComparisonBinaryBytecode(bytecode, node, symbolTable,
                                                       "greater than or equal to", inst.GEQ);
                break;
            case Node.AND:
                this._generateComparisonBinaryBytecode(bytecode, node, symbolTable,
                                                       "and", inst.AND);
                break;
            case Node.OR:
                this._generateComparisonBinaryBytecode(bytecode, node, symbolTable,
                                                       "or", inst.IOR);
                break;
            case Node.INTEGER_DIVISION:
                this._generateNumericBinaryBytecode(bytecode, node, symbolTable,
                                                    "divide", inst.DVI, null);
                break;
            case Node.MOD:
                this._generateNumericBinaryBytecode(bytecode, node, symbolTable,
                                                    "mod", inst.MOD, null);
                break;
            default:
                throw new PascalError(null, "can't compile unknown node " + node.nodeType);
        }
    };

    // Generates code to do math on two operands.
    Compiler.prototype._generateNumericBinaryBytecode = function (bytecode, node,
        symbolTable, opName, integerOpcode, realOpcode) {

        this._generateBytecode(bytecode, node.lhs, symbolTable);
        this._generateBytecode(bytecode, node.rhs, symbolTable);
        if (node.expressionType.nodeType === Node.SIMPLE_TYPE) {
            switch (node.expressionType.typeCode) {
                case inst.I:
                    if (integerOpcode === null) {
                        throw new PascalError(node.token, "can't " + opName + " integers");
                    }
                    bytecode.add(integerOpcode, 0, 0, opName + " integers");
                    break;
                case inst.R:
                    if (realOpcode === null) {
                        throw new PascalError(node.token, "can't " + opName + " reals");
                    }
                    bytecode.add(realOpcode, 0, 0, opName + " reals");
                    break;
                default:
                    throw new PascalError(node.token, "can't " + opName + " operands of type " +
                        inst.typeCodeToName(node.expressionType.typeCode));
            }
        } else {
            throw new PascalError(node.token, "can't " + opName +
                                 " operands of type " + node.expressionType.print());
        }
    };

    // Generates code to compare two operands.
    Compiler.prototype._generateComparisonBinaryBytecode = function (bytecode, node,
        symbolTable, opName, opcode) {

        this._generateBytecode(bytecode, node.lhs, symbolTable);
        this._generateBytecode(bytecode, node.rhs, symbolTable);
        var opType = node.lhs.expressionType;
        if (opType.nodeType === Node.SIMPLE_TYPE) {
            bytecode.add(opcode, opType.typeCode, 0, opName);
        } else {
            throw new PascalError(node.token, "can't do " + opName +
                                 " operands of type " + opType.print());
        }
    };

    // Adds the address of the node to the bytecode.
    Compiler.prototype._generateAddressBytecode = function(bytecode, node, symbolTable) {
        switch (node.nodeType) {
            case Node.IDENTIFIER:
                var symbolLookup = node.symbolLookup;

                var i;
                if (symbolLookup.symbol.byReference) {
                    // By reference, the address is all we need.
                    i = inst.LVA;
                } else {
                    // Load its address.
                    i = inst.LDA;
                }
                bytecode.add(i, symbolLookup.level,
                             symbolLookup.symbol.address, "address of " + node.print());
                break;

            case Node.ARRAY:
                var arrayType = node.variable.expressionType;

                // We compute the strides of the nested arrays as we go.
                var strides = [];

                // Start with the array's element size.
                strides.push(arrayType.elementType.getTypeSize());

                for (var i = 0; i < node.indices.length; i++) {
                    // Generate value of index.
                    this._generateBytecode(bytecode, node.indices[i], symbolTable);

                    // Subtract lower bound.
                    var low = arrayType.ranges[i].getRangeLowBound();
                    var cindex = bytecode.addConstant(low);
                    bytecode.add(inst.LDC, inst.I, cindex, "lower bound " + low);
                    bytecode.add(inst.SBI, 0, 0, "subtract lower bound");

                    // Add new stride.
                    var size = arrayType.ranges[i].getRangeSize();
                    strides.push(strides[strides.length - 1]*size);

                    // This would be a good place to do a runtime bounds check since
                    // we have the index and the size. The top of the stack should be
                    // non-negative and less than size.
                }

                // Pop the last stride, we don't need it. It represents the size of the
                // entire array.
                strides.pop();

                // Look up address of array.
                this._generateAddressBytecode(bytecode, node.variable, symbolTable);

                for (var i = 0; i < node.indices.length; i++) {
                    // Compute address of the slice or element.
                    var stride = strides.pop();
                    bytecode.add(inst.IXA, 0, stride,
                                 "address of array " +
                                 ((i === node.indices.length - 1) ? "element" : "slice") +
                                 " (size " + stride + ")");
                }
                break;

            case Node.FIELD_DESIGNATOR:
                var recordType = node.variable.expressionType;

                // Look up address of record.
                this._generateAddressBytecode(bytecode, node.variable, symbolTable);

                // Add the offset of the field.
                var cindex = bytecode.addConstant(node.field.offset);
                bytecode.add(inst.LDC, inst.I, cindex,
                             "offset of field \"" + node.field.name.print() + "\"");
                bytecode.add(inst.ADI, 0, 0, "add offset to record address");
                break;

            case Node.DEREFERENCE:
                // Just push the value of the pointer.
                this._generateBytecode(bytecode, node.variable, symbolTable);
                break;

            default:
                throw new PascalError(null, "unknown LHS node " + node.print());
        }
    };

    // Start a frame for a function/procedure.
    Compiler.prototype._beginExitFrame = function () {
        this.exitInstructions.push([]);
    };

    // Add an address of an instruction to update once we know the end of the function.
    Compiler.prototype._addExitInstruction = function (address) {
        this.exitInstructions[this.exitInstructions.length - 1].push(address);
    };

    // End a frame for a function/procedure, returning a list of addresses of UJP functions
    // to update.
    Compiler.prototype._endExitFrame = function () {
        return this.exitInstructions.pop();
    };

    return Compiler;
});
