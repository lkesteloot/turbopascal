// The result of a symbol lookup.

define(function () {
    var SymbolLookup = function (symbol, level) {
        // The symbol found.
        this.symbol = symbol;

        // The number of levels that had to be searched. Zero means it was
        // found in the innermost level.
        this.level = level;
    };

    return SymbolLookup;
});
