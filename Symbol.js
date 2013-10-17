// Stores information about a single symbol.

'use strict';

define(function () {
    /**
     * Create a new symbol.
     *
     * name: name of symbol (original case is fine).
     * type: type of the symbol (Node.SIMPLE_TYPE, etc.).
     * address:
     *     if variable: address of symbol relative to mark pointer.
     *     if user procedure: address in istore.
     *     if system procedure: index into native array.
     * isNative: true if it's a native subprogram.
     * value: node of value if it's a constant.
     * byReference: whether this symbol is a reference or a value. This only applies
     *     to function/procedure parameters.
     */
    var Symbol = function (name, type, address, byReference) {
        this.name = name;
        this.type = type;
        this.address = address;
        this.isNative = false;
        this.value = null;
        this.byReference = byReference;
    };

    return Symbol;
});
