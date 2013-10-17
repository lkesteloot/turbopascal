// The bytecode object. Stores all bytecodes for a program, along with accompanying
// data (such as program constants).

define(["inst", "utils"], function (inst, utils) {
    var Bytecode = function (native) {
        // Instructions. Array of doubles.
        this.istore = [];

        // Constants. This is an ordered list of JavaScript constant objects, such
        // as numbers and strings.
        this.constants = [];

        // Typed constants. These are copied to the start of the dstore when
        // the bytecode is loaded.
        this.typedConstants = [];

        // Index into istore where program should start.
        this.startAddress = 0;

        // Map from istore address to comment.
        this.comments = {};

        // Native methods.
        this.native = native;
    };

    // Add a constant (of any type), returning the cindex.
    Bytecode.prototype.addConstant = function (c) {
        // Re-use existing constants. We could use a hash table for this.
        for (var i = 0; i < this.constants.length; i++) {
            if (c === this.constants[i]) {
                return i;
            }
        }

        // Add new constants.
        this.constants.push(c);
        return this.constants.length - 1;
    };

    // Add an array of words to the end of the typed constants. Returns the
    // address of the item that was just added.
    Bytecode.prototype.addTypedConstants = function (raw) {
        var address = this.typedConstants.length;

        // Append entire "raw" array to the back of the typedConstants array.
        this.typedConstants.push.apply(this.typedConstants, raw);

        return address;
    };

    // Add an opcode to the istore.
    Bytecode.prototype.add = function (opcode, operand1, operand2, comment) {
        var i = inst.make(opcode, operand1, operand2);
        var address = this.getNextAddress();
        this.istore.push(i);
        if (comment) {
            this.addComment(address, comment);
        }
    };

    // Replace operand2 of the instruction.
    Bytecode.prototype.setOperand2 = function (address, operand2) {
        var i = this.istore[address];
        i = inst.make(inst.getOpcode(i), inst.getOperand1(i), operand2);
        this.istore[address] = i;
    };

    // Return the next address to be added to the istore.
    Bytecode.prototype.getNextAddress = function () {
        return this.istore.length;
    };

    // Return a printable version of the bytecode object.
    Bytecode.prototype.print = function () {
        return this._printConstants() + "\n" + this._printIstore();
    };

    // Set the starting address to the next instruction that will be added.
    Bytecode.prototype.setStartAddress = function () {
        this.startAddress = this.getNextAddress();
    };

    // Add a comment to the address.
    Bytecode.prototype.addComment = function (address, comment) {
        var existingComment = this.comments[address];
        if (existingComment) {
            // Add to existing comment.
            comment = existingComment + "; " + comment;
        }
        this.comments[address] = comment;
    };

    // Return a printable version of the constant table.
    Bytecode.prototype._printConstants = function () {
        var lines = [];
        for (var i = 0; i < this.constants.length; i++) {
            var value = this.constants[i];
            if (typeof(value) === "string") {
                value = "'" + value + "'";
            }
            lines.push(utils.rightAlign(i, 4) + ": " + value);
        }

        return "Constants:\n" + lines.join("\n") + "\n";
    };

    // Return a printable version of the istore array.
    Bytecode.prototype._printIstore = function () {
        var lines = [];
        for (var address = 0; address < this.istore.length; address++) {
            var line = utils.rightAlign(address, 4) + ": " +
                utils.leftAlign(inst.disassemble(this.istore[address]), 11);
            var comment = this.comments[address];
            if (comment) {
                line += " ; " + comment;
            }
            lines.push(line);
        }

        return "Istore:\n" + lines.join("\n") + "\n";
    };

    return Bytecode;
});
