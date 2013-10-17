// The mouse sub-system.

define(["Node"], function (Node) {
    var gWasInit = false;
    var gX = 0;
    var gY = 0;
    var gButton = 0;

    var initMouseModule = function () {
        if (!gWasInit) {
            var $canvas = $("#canvas");
            $canvas.mousemove(function (event) {
                var rect = this.getBoundingClientRect();

                gX = event.clientX - rect.left;
                gY = event.clientY - rect.top;
            });
            $canvas.mousedown(function (event) {
                gButton = 1;
            });
            $canvas.mouseup(function (event) {
                gButton = 0;
            });

            gWasInit = true;
        }
    };

    var importSymbols = function (symbolTable) {
        var symbol;
        symbolTable.addNativeFunction("ShowCursor", Node.voidType, [], function (ctl) {
            // I don't know what module this is in. It's not documented in the
            // reference books.
        });
        symbolTable.addNativeFunction("HideCursor", Node.voidType, [], function (ctl) {
            // I don't know what module this is in. It's not documented in the
            // reference books.
        });
        symbol = symbolTable.addNativeFunction("GetMouseStatus", Node.voidType,
                                      [Node.integerType, Node.integerType, Node.integerType],
                                      function (ctl, x, y, button) {

            initMouseModule();

            // Set the parameters x, y, and button.
            ctl.writeDstore(x, gX);
            ctl.writeDstore(y, gY);
            ctl.writeDstore(button, gButton);
        });
        symbol.type.parameters[0].byReference = true;
        symbol.type.parameters[1].byReference = true;
        symbol.type.parameters[2].byReference = true;
    };

    return {
        importSymbols: importSymbols
    };
});
