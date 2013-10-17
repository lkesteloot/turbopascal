// An object that stores a linear array of raw data (constants) and a parallel
// array of their simple type codes.

define(function () {
    var RawData = function () {
        this.length = 0;
        this.data = [];
        this.simpleTypeCodes = [];
    };

    // Adds a piece of data and its simple type (inst.I, etc.) to the list.
    RawData.prototype.add = function (datum, simpleTypeCode) {
        this.length++;
        this.data.push(datum);
        this.simpleTypeCodes.push(simpleTypeCode);
    };

    // Adds a SIMPLE_TYPE node.
    RawData.prototype.addNode = function (node) {
        this.add(node.getConstantValue(), node.expressionType.getSimpleTypeCode());
    };

    // Print the array for human debugging.
    RawData.prototype.print = function () {
        return "(" + this.data.join(", ") + ")";
    };

    return RawData;
});
