// The object that's stored in the Native store.

define(function () {
    // Object that's stored in the Native array.
    var NativeProcedure = function (name, returnType, parameterTypes, fn) {
        this.name = name;
        this.returnType = returnType;
        this.parameterTypes = parameterTypes;
        this.fn = fn;
    };

    return NativeProcedure;
});
