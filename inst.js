// Instruction set of p-machine. This machine language is compatible with the
// p-code of 1978 UCSD Pascal.
// 
// References:
//     http://cs2.uco.edu/~trt/cs4173/pspec.pdf
//     http://cs2.uco.edu/~trt/cs4933/P-MachineSimulator.pdf

define(["PascalError"], function (PascalError) {
    var OPCODE_BITS = 8;
    var OPERAND1_BITS = 9;
    var OPERAND2_BITS = 15;
    var OPCODE_MASK = (1 << OPCODE_BITS) - 1;
    var OPERAND1_MASK = (1 << OPERAND1_BITS) - 1;
    var OPERAND2_MASK = (1 << OPERAND2_BITS) - 1;
    var OPCODE_SHIFT = 0;
    var OPERAND1_SHIFT = OPCODE_SHIFT + OPCODE_BITS;
    var OPERAND2_SHIFT = OPERAND1_SHIFT + OPERAND1_BITS;

    var defs = {
        // Op codes.            Description                  operand1        operand2
        // Subprogram linkage.
        CUP: 0x00,      //      Call user procedure          argsize         iaddr
        CSP: 0x01,      //      Call standard procedure      argsize         stdfunction
        ENT: 0x02,      //      Entry                        register        amount
        MST: 0x03,      //      Mark stack                   level
        RTN: 0x04,      //      Return                       type
        // Comparison.
        EQU: 0x05,      //      Equality                     type
        NEQ: 0x06,      //      Inequality                   type
        GRT: 0x07,      //      Greater than                 type
        GEQ: 0x08,      //      Greater than or equal        type
        LES: 0x09,      //      Less than                    type
        LEQ: 0x0A,      //      Less than or equal           type
        // Integer arithmetic.
        ADI: 0x0B,      //      Integer addition
        SBI: 0x0C,      //      Integer subtraction
        NGI: 0x0D,      //      Integer sign inversion
        MPI: 0x0E,      //      Integer multiplication
        DVI: 0x0F,      //      Integer division
        MOD: 0x10,      //      Integer modulo
        ABI: 0x11,      //      Integer absolute value
        SQI: 0x12,      //      Integer square
        INC: 0x13,      //      Integer increment            i-type
        DEC: 0x14,      //      Integer decrement            i-type
        // Real arithmetic.     
        ADR: 0x15,      //      Real addition
        SBR: 0x16,      //      Real subtraction
        NGR: 0x17,      //      Real sign inversion
        MPR: 0x18,      //      Real multiplication
        DVR: 0x19,      //      Real division
        ABR: 0x1A,      //      Real absolute value
        SQR: 0x1B,      //      Real square
        // Boolean.
        IOR: 0x1C,      //      Inclusive OR.
        AND: 0x1D,      //      AND
        XOR: 0x1E,      //      Exclusive OR.
        NOT: 0x1F,      //      NOT.
        // Set operations.
        INN: 0x20,      //      Set membership.
        UNI: 0x21,      //      Set union.
        INT: 0x22,      //      Set intersection.
        DIF: 0x23,      //      Set difference.
        CMP: 0x24,      //      Set complement.
        SGS: 0x25,      //      Generate singleton set.
        // Jump.
        UJP: 0x26,      //      Unconditional jump.                          iaddr
        XJP: 0x27,      //      Indexed jump.                                iaddr
        FJP: 0x28,      //      False jump.                                  iaddr
        TJP: 0x29,      //      True jump.                                   iaddr
        // Conversion.  
        FLT: 0x2A,      //      Integer to real.
        FLO: 0x2B,      //      Integer to real (2nd entry on stack).
        TRC: 0x2C,      //      Truncate.
        RND: 0x2C,      //      Round.
        CHR: 0x2C,      //      Integer to char.
        ORD: 0x2C,      //      Anything to integer.
        // Termination.
        STP: 0x30,      //      Stop.
        // Data reference.
        LDA: 0x31,      //      Load address of data         level           offset
        LDC: 0x32,      //      Load constant                type            cindex
        LDI: 0x33,      //      Load indirect                type
        LVA: 0x34,      //      Load value (address)         level           offset
        LVB: 0x35,      //      Load value (boolean)         level           offset
        LVC: 0x36,      //      Load value (character)       level           offset
        LVI: 0x37,      //      Load value (integer)         level           offset
        LVR: 0x38,      //      Load value (real)            level           offset
        LVS: 0x39,      //      Load value (set)             level           offset
        STI: 0x3A,      //      Store indirect               type
        IXA: 0x3B,      //      Compute indexed address                      stride

        // Registers.
        REG_SP: 0x00,   //      Stack pointer.
        REG_EP: 0x01,   //      Extreme pointer (not used in this machine).
        REG_MP: 0x02,   //      Mark pointer.
        REG_PC: 0x03,   //      Program counter.
        REG_NP: 0x04,   //      New pointer.

        // Types.
        A: 0x00,        //      Address.
        B: 0x01,        //      Boolean.
        C: 0x02,        //      Character.
        I: 0x03,        //      Integer.
        R: 0x04,        //      Real.
        S: 0x05,        //      String.
        T: 0x06,        //      Set.
        P: 0x07,        //      Procedure (aka void, returned by procedure).
        X: 0x08,        //      Any.

        // The Mark is the area at the bottom of each frame. It contains (low to high address):
        //
        //     Return value (rv).
        //     Static link (sl).
        //     Dynamic link (dl).
        //     Extreme pointer (es), not used.
        //     Return address (ra).
        //
        MARK_SIZE: 5,

        // Opcode number (such as 0x32) to name ("LDC").
        opcodeToName: {
            // Populated procedurally below.
        },

        // Construct a machine language instruction.
        make: function (opcode, operand1, operand2) {
            // Allow caller to leave out these operands.
            operand1 = operand1 || 0;
            operand2 = operand2 || 0;

            // Sanity check.
            if (operand1 < 0) {
                throw new PascalError(null, "negative operand1: " + operand1);
            }
            if (operand1 > OPERAND1_MASK) {
                throw new PascalError(null, "too large operand1: " + operand1);
            }
            if (operand2 < 0) {
                throw new PascalError(null, "negative operand2: " + operand2);
            }
            if (operand2 > OPERAND2_MASK) {
                throw new PascalError(null, "too large operand2: " + operand2);
            }

            return (opcode << OPCODE_SHIFT) |
                (operand1 << OPERAND1_SHIFT) |
                (operand2 << OPERAND2_SHIFT);
        },

        // Return the opcode of the instruction.
        getOpcode: function (i) {
            return (i >>> OPCODE_SHIFT) & OPCODE_MASK;
        },

        // Return operand 1 of the instruction.
        getOperand1: function (i) {
            return (i >>> OPERAND1_SHIFT) & OPERAND1_MASK;
        },

        // Return operand 2 of the instruction.
        getOperand2: function (i) {
            return (i >>> OPERAND2_SHIFT) & OPERAND2_MASK;
        },

        // Return a string version of the instruction.
        disassemble: function (i) {
            var opcode = this.getOpcode(i);
            var operand1 = this.getOperand1(i);
            var operand2 = this.getOperand2(i);

            return this.opcodeToName[opcode] + " " + operand1 + " " + operand2;
        },

        // Converts a type code like inst.I to "integer", or null if not valid.
        typeCodeToName: function (typeCode) {
            switch (typeCode) {
                case this.A:
                    return "pointer";
                case this.B:
                    return "boolean";
                case this.C:
                    return "char";
                case this.I:
                    return "integer";
                case this.R:
                    return "real";
                case this.S:
                    return "string";
                default:
                    throw new PascalError(null, "unknown type code " + typeCode);
            }
        }
    };

    // Make an inverse table of opcodes.
    defs.opcodeToName[defs.CUP] = "CUP";
    defs.opcodeToName[defs.CSP] = "CSP";
    defs.opcodeToName[defs.ENT] = "ENT";
    defs.opcodeToName[defs.MST] = "MST";
    defs.opcodeToName[defs.RTN] = "RTN";
    defs.opcodeToName[defs.EQU] = "EQU";
    defs.opcodeToName[defs.NEQ] = "NEQ";
    defs.opcodeToName[defs.GRT] = "GRT";
    defs.opcodeToName[defs.GEQ] = "GEQ";
    defs.opcodeToName[defs.LES] = "LES";
    defs.opcodeToName[defs.LEQ] = "LEQ";
    defs.opcodeToName[defs.ADI] = "ADI";
    defs.opcodeToName[defs.SBI] = "SBI";
    defs.opcodeToName[defs.NGI] = "NGI";
    defs.opcodeToName[defs.MPI] = "MPI";
    defs.opcodeToName[defs.DVI] = "DVI";
    defs.opcodeToName[defs.MOD] = "MOD";
    defs.opcodeToName[defs.ABI] = "ABI";
    defs.opcodeToName[defs.SQI] = "SQI";
    defs.opcodeToName[defs.INC] = "INC";
    defs.opcodeToName[defs.DEC] = "DEC";
    defs.opcodeToName[defs.ADR] = "ADR";
    defs.opcodeToName[defs.SBR] = "SBR";
    defs.opcodeToName[defs.NGR] = "NGR";
    defs.opcodeToName[defs.MPR] = "MPR";
    defs.opcodeToName[defs.DVR] = "DVR";
    defs.opcodeToName[defs.ABR] = "ABR";
    defs.opcodeToName[defs.SQR] = "SQR";
    defs.opcodeToName[defs.IOR] = "IOR";
    defs.opcodeToName[defs.AND] = "AND";
    defs.opcodeToName[defs.XOR] = "XOR";
    defs.opcodeToName[defs.NOT] = "NOT";
    defs.opcodeToName[defs.INN] = "INN";
    defs.opcodeToName[defs.UNI] = "UNI";
    defs.opcodeToName[defs.INT] = "INT";
    defs.opcodeToName[defs.DIF] = "DIF";
    defs.opcodeToName[defs.CMP] = "CMP";
    defs.opcodeToName[defs.SGS] = "SGS";
    defs.opcodeToName[defs.UJP] = "UJP";
    defs.opcodeToName[defs.XJP] = "XJP";
    defs.opcodeToName[defs.FJP] = "FJP";
    defs.opcodeToName[defs.TJP] = "TJP";
    defs.opcodeToName[defs.FLT] = "FLT";
    defs.opcodeToName[defs.FLO] = "FLO";
    defs.opcodeToName[defs.TRC] = "TRC";
    defs.opcodeToName[defs.RND] = "RND";
    defs.opcodeToName[defs.CHR] = "CHR";
    defs.opcodeToName[defs.ORD] = "ORD";
    defs.opcodeToName[defs.STP] = "STP";
    defs.opcodeToName[defs.LDA] = "LDA";
    defs.opcodeToName[defs.LDC] = "LDC";
    defs.opcodeToName[defs.LDI] = "LDI";
    defs.opcodeToName[defs.LVA] = "LVA";
    defs.opcodeToName[defs.LVB] = "LVB";
    defs.opcodeToName[defs.LVC] = "LVC";
    defs.opcodeToName[defs.LVI] = "LVI";
    defs.opcodeToName[defs.LVR] = "LVR";
    defs.opcodeToName[defs.LVS] = "LVS";
    defs.opcodeToName[defs.STI] = "STI";
    defs.opcodeToName[defs.IXA] = "IXA";

    return defs;
});
