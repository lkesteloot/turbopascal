// Virtual p-machine (pseudo-machine) for bytecode.

'use strict';

define(["inst", "PascalError", "utils"], function (inst, PascalError, utils) {
    var Machine = function (bytecode, keyboard) {
        this.bytecode = bytecode;
        this.keyboard = keyboard;

        // Time that the program was started, in ms since epoch.
        this.startTime = 0;

        // Data store. Used for the stack, which grows up from address 0.
        this.dstore = new Array(65536);

        // Program counter. Points into the istore of the bytecode.
        this.pc = 0;

        // Stack Pointer. Points into the dstore. The specifications for the
        // p-machine say that SP points to the top-most item on the stack (the
        // item most recently pushed), but here we point one past that. I'm too
        // used to the latter convention and it would cause too many bugs for
        // me to switch. Besides, other docs imply that the p-machine used my
        // convention anyway, so I can't be sure.
        this.sp = 0;

        // Mark Pointer. Points into the dstore. Points to the bottom of the
        // stack frame.
        this.mp = 0;

        // New Pointer. Points into the dstore. Points to the bottom of the heap,
        // the lowest address within the heap.
        this.np = 0;

        // Extreme Pointer. Points to the highest stack address used by the
        // currently-executing procedure. This is an optimization so that
        // we only need to check in one place (when EP is increased) whether
        // we've crashed into the New Pointer. We don't use this.
        this.ep = 0;

        // The state of the machine (STATE_...).
        this.state = Machine.STATE_STOPPED;

        // Debug callback. Can be called with a string that should be displayed to
        // the user.
        this.debugCallback = null;

        // Finish callback. Called when the program terminates, either by running off
        // the end of the program's begin/end block, or by calling halt. The callback
        // is passed the number of seconds that the program ran.
        this.finishCallback = null;

        // Callback that standard output is sent to. This is called once per
        // line of output, and the line is the only parameter.
        this.outputCallback = null;

        // The number of ms that the program is expecting us to delay now.
        this.pendingDelay = 0;

        // Control object for native functions to manipulate this machine.
        var self = this;
        this.control = {
            stop: function () {
                self.stopProgram();
            },
            delay: function (ms) {
                self.pendingDelay = ms;
            },
            writeln: function (line) {
                if (self.outputCallback !== null) {
                    self.outputCallback(line);
                }
            },
            readDstore: function (address) {
                return self.dstore[address];
            },
            writeDstore: function (address, value) {
                self.dstore[address] = value;
            },
            malloc: function (size) {
                return self._malloc(size);
            },
            free: function (p) {
                return self._free(p);
            },
            keyPressed: function () {
                if (self.keyboard) {
                    return self.keyboard.keyPressed();
                } else {
                    return false;
                }
            },
            readKey: function () {
                if (self.keyboard) {
                    return self.keyboard.readKey();
                } else {
                    return 0;
                }
            }
        };
    };

    // Various machine states.
    Machine.STATE_STOPPED = 0;
    Machine.STATE_RUNNING = 1;

    // Run the bytecode.
    Machine.prototype.run = function () {
        // Reset the machine.
        this._reset();

        // Start the machine.
        this.state = Machine.STATE_RUNNING;
        this.startTime = new Date().getTime();

        // Run the program.
        this._dumpState();

        var self = this;
        var stepAndTimeout = function () {
            self.step(100000);
            if (self.state === Machine.STATE_RUNNING) {
                var delay = self.pendingDelay;
                self.pendingDelay = 0;
                setTimeout(stepAndTimeout, delay);
            }
        };
        stepAndTimeout();
    };

    // Step "count" instructions. Does nothing if the program is stopped.
    Machine.prototype.step = function (count) {
        for (var i = 0; i < count && this.state === Machine.STATE_RUNNING &&
             this.pendingDelay === 0; i++) {

            try {
                this._executeInstruction();
            } catch (e) {
                if (e instanceof PascalError) {
                    console.log(e.getMessage());
                }
                console.log(e.stack);
                console.log(this._getState());
                this.stopProgram();
            }
            this._dumpState();
        }
    };

    // Set a callback for debugging. The callback is called with a string that should
    // be displayed to the user.
    Machine.prototype.setDebugCallback = function (debugCallback) {
        this.debugCallback = debugCallback;
    };

    // Set a callback for when the program ends. The callback is called with a number for
    // the number of seconds that the program ran.
    Machine.prototype.setFinishCallback = function (finishCallback) {
        this.finishCallback = finishCallback;
    };

    // Set a callback for standard output. The callback is called with a string to
    // write.
    Machine.prototype.setOutputCallback = function (outputCallback) {
        this.outputCallback = outputCallback;
    };

    // Dump the state of the machine to the debug callback.
    Machine.prototype._dumpState = function () {
        if (this.debugCallback != null) {
            this.debugCallback(this._getState());
        }
    };

    // Generate a string which is a human-readable version of the machine state.
    Machine.prototype._getState = function () {
        // Clip off stack display since it can be very large with arrays.
        var maxStack = 20;
        // Skip typed constants.
        var startStack = this.bytecode.typedConstants.length;
        var clipStack = Math.max(startStack, this.sp - maxStack);
        var stack = JSON.stringify(this.dstore.slice(clipStack, this.sp));
        if (clipStack > startStack) {
            // Trim stack.
            stack = stack[0] + "...," + stack.slice(1, stack.length);
        }

        // Clip off heap display since it can be very large with arrays.
        var maxHeap = 20;
        var heapSize = this.dstore.length - this.np;
        var heapDisplay = Math.min(maxHeap, heapSize);
        var heap = JSON.stringify(this.dstore.slice(
            this.dstore.length - heapDisplay, this.dstore.length));
        if (heapDisplay != heapSize) {
            // Trim heap.
            heap = heap[0] + "...," + heap.slice(1, heap.length);
        }

        var state = [
            "pc = " + utils.rightAlign(this.pc, 4),
            utils.leftAlign(inst.disassemble(this.bytecode.istore[this.pc]), 11),
            /// "sp = " + utils.rightAlign(this.sp, 3),
            "mp = " + utils.rightAlign(this.mp, 3),
            "stack = " + utils.leftAlign(stack, 40),
            "heap = " + heap
        ];

        return state.join(" ");
    }

    // Push a value onto the stack.
    Machine.prototype._push = function (value) {
        // Sanity check.
        if (value === null || value === undefined) {
            throw new PascalError(null, "can't push " + value);
        }
        this.dstore[this.sp++] = value;
    };

    // Pop a value off the stack.
    Machine.prototype._pop = function () {
        --this.sp;
        var value = this.dstore[this.sp];

        // Set it to undefined so we can find bugs more easily.
        this.dstore[this.sp] = undefined;

        return value;
    };

    // Reset the machines state.
    Machine.prototype._reset = function () {
        // Copy the typed constants into the dstore.
        for (var i = 0; i < this.bytecode.typedConstants.length; i++) {
            this.dstore[i] = this.bytecode.typedConstants[i];
        }

        // The bytecode has a specific start address (the main block of the program).
        this.pc = this.bytecode.startAddress;
        this.sp = this.bytecode.typedConstants.length;
        this.mp = 0;
        this.np = this.dstore.length;
        this.ep = 0;
        this.state = Machine.STATE_STOPPED;
    };

    // Get the static link off the mark.
    Machine.prototype._getStaticLink = function (mp) {
        // The static link is the second entry in the mark.
        return this.dstore[mp + 1];
    };

    // Verifies that the data address is valid, meaning that it's in the
    // stack or the heap. Throws if not.
    Machine.prototype._checkDataAddress = function (address) {
        if (address >= this.sp && address < this.np) {
            throw new PascalError(null, "invalid data address (" +
                this.sp + " <= " + address + " < " + this.np + ")");
        }
    };

    // If the program is running, stop it and called the finish callback.
    Machine.prototype.stopProgram = function () {
        if (this.state !== Machine.STATE_STOPPED) {
            this.state = Machine.STATE_STOPPED;
            if (this.finishCallback !== null) {
                this.finishCallback((new Date().getTime() - this.startTime)/1000);
            }
        }
    };

    // Execute the next instruction.
    Machine.prototype._executeInstruction = function () {
        // Get this instruction.
        var pc = this.pc;
        var i = this.bytecode.istore[pc];

        // Advance the PC right away. Various instructions can then modify it.
        this.pc++;

        var opcode = inst.getOpcode(i);
        var operand1 = inst.getOperand1(i);
        var operand2 = inst.getOperand2(i);

        switch (opcode) {
            case inst.CUP:
                // Call User Procedure. By now SP already points past the mark
                // and the parameters. So we set the new MP by backing off all
                // those. Opcode1 is the number of parameters passed in.
                this.mp = this.sp - operand1 - inst.MARK_SIZE;

                // Store the return address.
                this.dstore[this.mp + 4] = this.pc;

                // Jump to the procedure.
                this.pc = operand2;
                break;
            case inst.CSP:
                // Call System Procedure. We look up the index into the Native object
                // and call it.
                var nativeProcedure = this.bytecode.native.get(operand2);

                // Pop parameters.
                var parameters = [];
                for (var i = 0; i < operand1; i++) {
                    // They are pushed on the stack first to last, so we
                    // unshift them (push them on the front) so they end up in
                    // the right order.
                    parameters.unshift(this._pop());
                }

                // Push the control object that the native function can use to
                // control this machine.
                parameters.unshift(this.control);

                var returnValue = nativeProcedure.fn.apply(null, parameters);

                // Push result if we're a function.
                if (!nativeProcedure.returnType.isSimpleType(inst.P)) {
                    this._push(returnValue);
                }
                break;
            case inst.ENT:
                // Entry. Set SP or EP to MP + operand2, which is the sum of
                // the mark size, the parameters, and all local variables. If
                // we're setting SP, then we're making room for local variables
                // and preparing the SP to do computation.
                var address = this.mp + operand2;
                if (operand1 === 0) {
                    // Clear the local variable area.
                    for (var i = this.sp; i < address; i++) {
                        this.dstore[i] = 0;
                    }
                    this.sp = address;
                } else {
                    this.ep = address;
                }
                break;
            case inst.MST:
                // Follow static links "operand1" times.
                var sl = this.mp;
                for (var i = 0; i < operand1; i++) {
                    sl = this._getStaticLink(sl);
                }

                // Mark Stack.
                this._push(0);              // RV, set by called function.
                this._push(sl);             // SL
                this._push(this.mp);        // DL
                this._push(this.ep);        // EP
                this._push(0);              // RA, set by CUP.
                break;
            case inst.RTN:
                // Return.
                var oldMp = this.mp;
                this.mp = this.dstore[oldMp + 2];
                this.ep = this.dstore[oldMp + 3];
                this.pc = this.dstore[oldMp + 4];
                if (operand1 === inst.P) {
                    // Procedure, pop off the return value.
                    this.sp = oldMp;
                } else {
                    // Function, leave the return value on the stack.
                    this.sp = oldMp + 1;
                }
                break;
            case inst.EQU:
                // Equal To.
                var op2 = this._pop();
                var op1 = this._pop();
                this._push(op1 === op2);
                break;
            case inst.NEQ:
                // Not Equal To.
                var op2 = this._pop();
                var op1 = this._pop();
                this._push(op1 !== op2);
                break;
            case inst.GRT:
                // Greater Than.
                var op2 = this._pop();
                var op1 = this._pop();
                this._push(op1 > op2);
                break;
            case inst.GEQ:
                // Greater Than Or Equal To.
                var op2 = this._pop();
                var op1 = this._pop();
                this._push(op1 >= op2);
                break;
            case inst.LES:
                // Less Than.
                var op2 = this._pop();
                var op1 = this._pop();
                this._push(op1 < op2);
                break;
            case inst.LEQ:
                // Less Than Or Equal To.
                var op2 = this._pop();
                var op1 = this._pop();
                this._push(op1 <= op2);
                break;
            case inst.ADI:
            case inst.ADR:
                // Add integer/real.
                var op2 = this._pop();
                var op1 = this._pop();
                this._push(op1 + op2);
                break;
            case inst.SBI:
            case inst.SBR:
                // Subtract integer/real.
                var op2 = this._pop();
                var op1 = this._pop();
                this._push(op1 - op2);
                break;
            case inst.NGI:
            case inst.NGR:
                // Negate.
                this._push(-this._pop());
                break;
            case inst.MPI:
            case inst.MPR:
                // Multiply integer/real.
                var op2 = this._pop();
                var op1 = this._pop();
                this._push(op1 * op2);
                break;
            case inst.DVI:
                // Divide integer.
                var op2 = this._pop();
                var op1 = this._pop();
                if (op2 === 0) {
                    throw new PascalError(null, "divide by zero");
                }
                this._push(utils.trunc(op1 / op2));
                break;
            case inst.MOD:
                // Modulo.
                var op2 = this._pop();
                var op1 = this._pop();
                if (op2 === 0) {
                    throw new PascalError(null, "modulo by zero");
                }
                this._push(op1 % op2);
                break;
            // case inst.ABI:
            // case inst.SQI:
            case inst.INC:
                // Increment.
                this._push(this._pop() + 1);
                break;
            case inst.DEC:
                // Decrement.
                this._push(this._pop() - 1);
                break;
            case inst.DVR:
                // Divide real.
                var op2 = this._pop();
                var op1 = this._pop();
                if (op2 === 0) {
                    throw new PascalError(null, "divide by zero");
                }
                this._push(op1 / op2);
                break;
            // case inst.ABR:
            // case inst.SQR:
            case inst.IOR:
                // Inclusive OR.
                var op2 = this._pop();
                var op1 = this._pop();
                this._push(op1 || op2);
                break;
            case inst.AND:
                // AND
                var op2 = this._pop();
                var op1 = this._pop();
                this._push(op1 && op2);
                break;
            // case inst.XOR:
            case inst.NOT:
                this._push(!this._pop());
                break;
            // case inst.INN:
            // case inst.UNI:
            // case inst.INT:
            // case inst.DIF:
            // case inst.CMP:
            // case inst.SGS:
            case inst.UJP:
                this.pc = operand2;
                break;
            case inst.XJP:
                this.pc = this._pop();
                break;
            case inst.FJP:
                if (!this._pop()) {
                    this.pc = operand2;
                }
                break;
            case inst.TJP:
                if (this._pop()) {
                    this.pc = operand2;
                }
                break;
            case inst.FLT:
                // Cast Integer to Real.
                // Nothing to do, we don't distinguish between integers and real.
                break;
            // case inst.FLO:
            // case inst.TRC:
            // case inst.RND:
            // case inst.CHR:
            // case inst.ORD:
            case inst.STP:
                // Stop.
                this.stopProgram();
                break;
            case inst.LDA:
                // Load Address. Pushes the address of a variable.
                var address = this._computeAddress(operand1, operand2);
                this._push(address);
                break;
            case inst.LDC:
                // Load Constant.
                if (operand1 === inst.I || operand1 === inst.R ||
                    operand1 === inst.S || operand1 === inst.A) {

                    // Look up the constant in the constant pool.
                    this._push(this.bytecode.constants[operand2]);
                } else if (operand1 === inst.B) {
                    // Booleans are stored in operand2.
                    this._push(!!operand2);
                } else if (operand1 === inst.C) {
                    // Characters are stored in operand2.
                    this._push(operand2);
                } else {
                    throw new PascalError(null, "can't push constant of type " +
                                         inst.typeCodeToName(operand1));
                }
                break;
            case inst.LDI:
                // Load Indirect.
                var address = this._pop();
                this._checkDataAddress(address);
                this._push(this.dstore[address]);
                break;
            case inst.LVA:
            case inst.LVB:
            case inst.LVC:
            case inst.LVI:
            case inst.LVR:
                // Load Value.
                var address = this._computeAddress(operand1, operand2);
                this._checkDataAddress(address);
                this._push(this.dstore[address]);
                break;
            // case inst.LVS:
            case inst.STI:
                // Store Indirect.
                var value = this._pop();
                var address = this._pop();
                this._checkDataAddress(address);
                this.dstore[address] = value;
                break;
            case inst.IXA:
                // Indexed Address. a = a + index*stride
                var address = this._pop();
                var index = this._pop();
                address += index*operand2;
                this._push(address);
                break;
            default:
                throw new PascalError(null, "don't know how to execute instruction " +
                                     inst.opcodeToName[opcode]);
        }
    };

    // Given a level and an offset, returns the address in the dstore. The level is
    // the number of static links to dereference.
    Machine.prototype._computeAddress = function (level, offset) {
        var mp = this.mp;

        // Follow static link "level" times.
        for (var i = 0; i < level; i++) {
            mp = this._getStaticLink(mp);
        }

        return mp + offset;
    };

    // Allocate "size" words on the heap and return the new address. Throws if no
    // more heap is available.
    Machine.prototype._malloc = function (size) {
        // Make room for the object.
        this.np -= size;
        var address = this.np;

        // Blank out new allocation.
        for (var i = 0; i < size; i++) {
            this.dstore[address + i] = 0;
        }

        // Store size of allocation one word before the object.
        this.np--;
        this.dstore[this.np] = size;

        return address;
    };

    // Free the block on the heap pointed to by p.
    Machine.prototype._free = function (p) {
        // Get the size. We wrote it in the word before p.
        var size = this.dstore[p - 1];

        if (p === this.np + 1) {
            // This block is at the bottom of the heap. Just reclaim the memory.
            this.np += size + 1;
        } else {
            // Internal node. Not handled.
        }
    };

    return Machine;
});
