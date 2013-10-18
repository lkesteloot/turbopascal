// The graphics sub-system.

define(["Node"], function (Node) {
    var $canvas;
    var gCtx;
    var gGraphResult = 0;
    var grOk = 0;
    var grNoInitGraph = -1;
    var gPenX = 0;
    var gPenY = 0;
    var gTextFont = 0;
    var gTextDirection = 0;
    var gTextSize = 0;
    var gTextHorizontalAlign = 0;
    var gTextVerticalAlign = 0;

    // Default EGA color palette.
    // http://en.wikipedia.org/wiki/Enhanced_Graphics_Adapter#Color_palette
    var COLORS = [
        "#000000",
        "#0000AA",
        "#00AA00",
        "#00AAAA",
        "#AA0000",
        "#AA00AA",
        "#AA5500",
        "#AAAAAA",
        "#555555",
        "#5555FF",
        "#55FF55",
        "#55FFFF",
        "#FF5555",
        "#FF55FF",
        "#FFFF55",
        "#FFFFFF"
    ];
    // Like COLORS array but [R,G,B].
    var RGB_COLORS = [];
    // 24-bit int color to color map index.
    var COLOR_TO_INDEX = {};
    for (var i = 0; i < COLORS.length; i++) {
        COLOR_TO_INDEX[parseInt(COLORS[i].slice(1), 16)] = i;
        RGB_COLORS.push([
            parseInt(COLORS[i].slice(1, 3), 16),
            parseInt(COLORS[i].slice(3, 5), 16),
            parseInt(COLORS[i].slice(5, 7), 16)
        ]);
    }
    var WIDTH = 640;
    var HEIGHT = 350;
    var gCurrentColor = 0;
    var gBackgroundColor = 0;

    // Flag to remember whether the next graphics command should clear the device.
    var gMustClearDevice = false;

    // Check and clear the device if necessary.
    var checkClearDevice = function () {
        if (gMustClearDevice) {
            // Don't use clearRect(), since that sets the alpha to 0 and later
            // anti-aliased operations set the alpha to something gray, which
            // our Pascal code doesn't know about and can't handle.
            gCtx.fillStyle = COLORS[gBackgroundColor];
            gCtx.fillRect(0, 0, WIDTH, HEIGHT);
            gMustClearDevice = false;
        }
    };

    // Converts RGB from an RGB array to a color index.
    var rgbToIndex = function (data, offset) {
        // Convert to 24-bit integer.
        var color = (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2];

        // Map back to color map. Treat unknown as black.
        return COLOR_TO_INDEX[color] || 0;
    };

    // Returns the color at pixel x, y.
    var getPixel = function (x, y) {
        // Get raw pixel value.
        var data = gCtx.getImageData(x, y, 1, 1).data;

        // Convert to color index.
        return rgbToIndex(data, 0);
    };

    var importSymbols = function (symbolTable) {
        var symbol;

        // These types aren't documented anywhere I think.
        var node = new Node(Node.RECORD_TYPE, null, {
            fields: [
                new Node(Node.FIELD, null, {
                    name: Node.makeIdentifierNode("X"),
                    type: Node.integerType,
                    offset: 0
                }),
                new Node(Node.FIELD, null, {
                    name: Node.makeIdentifierNode("Y"),
                    type: Node.integerType,
                    offset: 1
                })
            ]
        });
        symbolTable.addType("PointType", node);

        // Error codes.
        symbolTable.addNativeConstant("grOk", grOk, Node.integerType);
        symbolTable.addNativeConstant("grNoInitGraph", grNoInitGraph, Node.integerType);
        // There are lots more of these errors. We can add them as we need them.

        // Graphics drivers.
        symbolTable.addNativeConstant("Detect", 0, Node.integerType);

        // Colors.
        symbolTable.addNativeConstant("Black", 0, Node.integerType);
        symbolTable.addNativeConstant("Blue", 1, Node.integerType);
        symbolTable.addNativeConstant("Green", 2, Node.integerType);
        symbolTable.addNativeConstant("Cyan", 3, Node.integerType);
        symbolTable.addNativeConstant("Red", 4, Node.integerType);
        symbolTable.addNativeConstant("Magenta", 5, Node.integerType);
        symbolTable.addNativeConstant("Brown", 6, Node.integerType);
        symbolTable.addNativeConstant("LightGray", 7, Node.integerType);
        symbolTable.addNativeConstant("DarkGray", 8, Node.integerType);
        symbolTable.addNativeConstant("LightBlue", 9, Node.integerType);
        symbolTable.addNativeConstant("LightGreen", 10, Node.integerType);
        symbolTable.addNativeConstant("LightCyan", 11, Node.integerType);
        symbolTable.addNativeConstant("LightRed", 12, Node.integerType);
        symbolTable.addNativeConstant("LightMagenta", 13, Node.integerType);
        symbolTable.addNativeConstant("Yellow", 14, Node.integerType);
        symbolTable.addNativeConstant("White", 15, Node.integerType);

        // Line styles.
        symbolTable.addNativeConstant("SolidLn", 0, Node.integerType);
        symbolTable.addNativeConstant("DottedLn", 1, Node.integerType);
        symbolTable.addNativeConstant("CenterLn", 2, Node.integerType);
        symbolTable.addNativeConstant("DashedLn", 3, Node.integerType);
        symbolTable.addNativeConstant("UserBitLn", 4, Node.integerType);

        // Line width.
        symbolTable.addNativeConstant("NormWidth", 1, Node.integerType);
        symbolTable.addNativeConstant("ThickWidth", 3, Node.integerType);

        // Text style.
        symbolTable.addNativeConstant("DefaultFont", 0, Node.integerType);
        symbolTable.addNativeConstant("TriplexFont", 1, Node.integerType);
        symbolTable.addNativeConstant("SmallFont", 2, Node.integerType);
        symbolTable.addNativeConstant("SansSerifFont", 3, Node.integerType);
        symbolTable.addNativeConstant("GothicFont", 4, Node.integerType);

        // Direction
        symbolTable.addNativeConstant("HorizDir", 0, Node.integerType);
        symbolTable.addNativeConstant("VertDir", 1, Node.integerType);

        // Character size.
        symbolTable.addNativeConstant("UserCharSize", 0, Node.integerType);

        // Clipping.
        symbolTable.addNativeConstant("ClipOn", true, Node.booleanType);
        symbolTable.addNativeConstant("ClipOff", false, Node.booleanType);

        // Bar3D.
        symbolTable.addNativeConstant("TopOn", true, Node.booleanType);
        symbolTable.addNativeConstant("TopOff", false, Node.booleanType);

        // Fill patterns.
        symbolTable.addNativeConstant("EmptyFill", 0, Node.integerType);
        symbolTable.addNativeConstant("SolidFill", 1, Node.integerType);
        symbolTable.addNativeConstant("LineFill", 2, Node.integerType);
        symbolTable.addNativeConstant("LtSlashFill", 3, Node.integerType);
        symbolTable.addNativeConstant("SlashFill", 4, Node.integerType);
        symbolTable.addNativeConstant("BkSlashFill", 5, Node.integerType);
        symbolTable.addNativeConstant("LtBkSlashFill", 6, Node.integerType);
        symbolTable.addNativeConstant("HatchFill", 7, Node.integerType);
        symbolTable.addNativeConstant("XHatchFill", 8, Node.integerType);
        symbolTable.addNativeConstant("InterleaveFill", 9, Node.integerType);
        symbolTable.addNativeConstant("WideDotFill", 10, Node.integerType);
        symbolTable.addNativeConstant("CloseDotFill", 11, Node.integerType);
        symbolTable.addNativeConstant("UserFill", 12, Node.integerType);

        // BitBlt.
        var cNormalPut = 0;
        var cXORPut = 1;
        var cOrPut = 2;
        var cAndPut = 3;
        var cNotPut = 4;
        symbolTable.addNativeConstant("NormalPut", cNormalPut, Node.integerType);
        symbolTable.addNativeConstant("XORPut", cXORPut, Node.integerType);
        symbolTable.addNativeConstant("OrPut", cOrPut, Node.integerType);
        symbolTable.addNativeConstant("AndPut", cAndPut, Node.integerType);
        symbolTable.addNativeConstant("NotPut", cNotPut, Node.integerType);

        // Text alignment.
        symbolTable.addNativeConstant("LeftText", 0, Node.integerType);
        symbolTable.addNativeConstant("CenterText", 1, Node.integerType);
        symbolTable.addNativeConstant("RightText", 2, Node.integerType);
        symbolTable.addNativeConstant("BottomText", 0, Node.integerType);
        symbolTable.addNativeConstant("TopText", 2, Node.integerType);

        symbolTable.addNativeFunction("InitGraph", Node.voidType,
                                      [Node.integerType, Node.integerType, Node.stringType],
                                      function (ctl) {

            // Initialize the graphics system.
            $("#screen").hide();
            $canvas = $("#canvas").show();
            if ($canvas.length > 0 && $canvas[0].getContext) {
                gCtx = $canvas[0].getContext("2d");
                gGraphResult = grOk;
            } else {
                gGraphResult = grNoInitGraph;
            }
            gMustClearDevice = true;
            // XXX Should write mode into the second parameter.
        });
        symbolTable.addNativeFunction("GraphResult", Node.integerType, [], function (ctl) {
            // The result of a graphics call.
            return gGraphResult;
        });
        symbolTable.addNativeFunction("SetColor", Node.voidType, [Node.integerType],
            function (ctl, color) {

            // Set the current drawing color.
            gCurrentColor = color;
        });
        symbolTable.addNativeFunction("SetBkColor", Node.voidType, [Node.integerType],
            function (ctl, color) {

            // Set the background color.
            gBackgroundColor = color;
        });
        symbolTable.addNativeFunction("SetFillStyle", Node.voidType,
                                      [Node.integerType, Node.integerType],
            function (ctl, fillStyle, color) {

            // Set the current fill style.
            if (fillStyle !== 1) { // SolidFill
                console.log("SetFillStyle: Only SolidFill is supported");
            }
            gCurrentColor = color;
        });
        symbolTable.addNativeFunction("SetLineStyle", Node.voidType,
                                      [Node.integerType, Node.integerType, Node.integerType],
            function (ctl, lineStyle, pattern, thickness) {
                // Not implemented.
        });
        symbolTable.addNativeFunction("GetMaxColor", Node.integerType, [], function (ctl) {
            // Return the maximum color number.
            return COLORS.length - 1;
        });
        symbolTable.addNativeFunction("GraphErrorMsg", Node.stringType, [Node.integerType],
                                      function (ctl, errorCode) {
            // Look this up in a table.
            return "error message here!";
        });
        symbolTable.addNativeFunction("GetMaxX", Node.integerType, [], function (ctl) {
            // Return the maximum X column.
            return WIDTH - 1;
        });
        symbolTable.addNativeFunction("GetMaxY", Node.integerType, [], function (ctl) {
            // Return the maximum Y row.
            return HEIGHT - 1;
        });
        symbolTable.addNativeFunction("GetPixel", Node.integerType,
                                      [Node.integerType, Node.integerType], function (ctl, x, y) {

            checkClearDevice();
            return getPixel(x, y);
        });
        symbolTable.addNativeFunction("PutPixel", Node.voidType,
                                      [Node.integerType, Node.integerType, Node.integerType],
                                      function (ctl, x, y, c) {

            checkClearDevice();
            if (x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT) {
                c = Math.floor(c);
                if (c < 0) {
                    c = 0;
                }
                if (c > COLORS.length - 1) {
                    c = COLORS.length - 1;
                }
                gCtx.fillStyle = COLORS[c];
                gCtx.fillRect(x, y, 1, 1);
            }
        });
        symbolTable.addNativeFunction("FloodFill", Node.voidType,
                                      [Node.integerType, Node.integerType, Node.integerType],
                                      function (ctl, x, y, edgeColor) {

            checkClearDevice();

            // Flood fill with the current fill pattern and color.
            var queue = [[x, y]];
            var fillColor = gCurrentColor;
            var fillColorRgb = RGB_COLORS[fillColor];

            // Getting each individual pixel is too slow, so we get the whole screen,
            // do the flood fill, and replace the whole thing.
            var imageData = gCtx.getImageData(0, 0, WIDTH, HEIGHT);
            var data = imageData.data;
            while (queue.length > 0) {
                var p = queue.pop();
                var x = p[0];
                var y = p[1];
                if (x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT) {
                    var offset = (x + y*WIDTH)*4;
                    var pixelColor = rgbToIndex(data, offset);
                    if (pixelColor != edgeColor && pixelColor != fillColor) {
                        // Draw the fill pixel.
                        data[offset + 0] = fillColorRgb[0];
                        data[offset + 1] = fillColorRgb[1];
                        data[offset + 2] = fillColorRgb[2];

                        // Push neighbors.
                        queue.push([x + 1, y]);
                        queue.push([x - 1, y]);
                        queue.push([x, y + 1]);
                        queue.push([x, y - 1]);
                    }
                }
            }
            gCtx.putImageData(imageData, 0, 0);
        });
        symbolTable.addNativeFunction("Circle", Node.voidType,
                                      [Node.integerType, Node.integerType, Node.integerType],
                                      function (ctl, cx, cy, r) {

            checkClearDevice();
            // Draw a circle with the current line style and color.
            if (false) {
                // This circle is anti-aliased, which messed up flood fills.
                gCtx.strokeStyle = COLORS[gCurrentColor];
                gCtx.beginPath();
                gCtx.arc(cx + 0.5, cy + 0.5, r, 0, Math.PI*2);
                gCtx.stroke();
            } else {
                gCtx.fillStyle = COLORS[gCurrentColor];

                // https://en.wikipedia.org/wiki/Midpoint_circle_algorithm
                var x = r;
                var y = 0;
                var radiusError = 1 - x;

                while (x >= y) {
                    // Eight octants.
                    gCtx.fillRect(cx + x, cy + y, 1, 1);
                    gCtx.fillRect(cx + y, cy + x, 1, 1);
                    gCtx.fillRect(cx - x, cy + y, 1, 1);
                    gCtx.fillRect(cx - y, cy + x, 1, 1);
                    gCtx.fillRect(cx - x, cy - y, 1, 1);
                    gCtx.fillRect(cx - y, cy - x, 1, 1);
                    gCtx.fillRect(cx + x, cy - y, 1, 1);
                    gCtx.fillRect(cx + y, cy - x, 1, 1);

                    y++;
                    if (radiusError < 0) {
                        radiusError += 2*y + 1;
                    } else {
                        x--;
                        radiusError += 2*(y - x + 1);
                    }
                }
            }
        });
        symbolTable.addNativeFunction("Rectangle", Node.voidType,
                                      [Node.integerType, Node.integerType,
                                          Node.integerType, Node.integerType],
                                      function (ctl, x1, y1, x2, y2) {

            checkClearDevice();
            // Draw a 2D rectangle with the current line style and color.
            gCtx.strokeStyle = COLORS[gCurrentColor];
            gCtx.rect(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
        });
        symbolTable.addNativeFunction("Bar", Node.voidType,
                                      [Node.integerType, Node.integerType,
                                          Node.integerType, Node.integerType],
                                      function (ctl, x1, y1, x2, y2) {

            checkClearDevice();
            // Draw a 2D bar with the current fill style and color.
            gCtx.fillStyle = COLORS[gCurrentColor];
            if (x2 < x1) {
                var t = x1;
                x1 = x2;
                x2 = t;
            }
            if (y2 < y1) {
                var t = y1;
                y1 = y2;
                y2 = t;
            }
            gCtx.fillRect(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
        });
        symbolTable.addNativeFunction("Line", Node.voidType,
                                      [Node.integerType, Node.integerType,
                                          Node.integerType, Node.integerType],
                                      function (ctl, x1, y1, x2, y2) {

            // Draw a line.
            checkClearDevice();
            gCtx.strokeStyle = COLORS[gCurrentColor];
            gCtx.beginPath();
            gCtx.moveTo(x1, y1);
            gCtx.lineTo(x2, y2);
            gCtx.stroke();
        });
        symbolTable.addNativeFunction("MoveTo", Node.voidType,
                                      [Node.integerType, Node.integerType],
                                      function (ctl, x, y) {

            // Move pen to location.
            gPenX = x;
            gPenY = y;
        });
        symbolTable.addNativeFunction("LineTo", Node.voidType,
                                      [Node.integerType, Node.integerType],
                                      function (ctl, x, y) {

            // Draw a line.
            checkClearDevice();
            gCtx.strokeStyle = COLORS[gCurrentColor];
            gCtx.beginPath();
            gCtx.moveTo(gPenX, gPenY);
            gPenX = x;
            gPenY = y;
            gCtx.lineTo(gPenX, gPenY);
            gCtx.stroke();
        });
        symbolTable.addNativeFunction("SetBorderLimits", Node.voidType,
                                      [Node.integerType, Node.integerType,
                                          Node.integerType, Node.integerType],
                                      function (ctl, x1, y1, x2, y2) {

            // This is not documented in the book. How did I find out about these?
            // It's probably a clipping rectangle.
        });
        symbol = symbolTable.addNativeFunction("FillPoly", Node.voidType,
                                      [Node.integerType, Node.voidType],
                                      function (ctl, count, p) {

            checkClearDevice();

            // Fill a polygon. The second parameter is a generic pointer to
            // an array of "count" records of type PointType.
            gCtx.fillStyle = COLORS[gCurrentColor];
            gCtx.beginPath();
            for (var i = 0; i < count; i++) {
                var x = ctl.readDstore(p + i*2);
                var y = ctl.readDstore(p + i*2 + 1);

                if (i === 0) {
                    gCtx.moveTo(x, y);
                } else {
                    gCtx.lineTo(x, y);
                }
            }
            gCtx.closePath();
            gCtx.fill();
        });
        symbol.type.parameters[1].byReference = true;
        symbolTable.addNativeFunction("ClearDevice", Node.voidType, [], function (ctl) {
            // Here we want to let the screen have a chance to draw itself, so we don't
            // want to clear it right away. Instead we remember that we should clear it,
            // and tell the system to wait a bit for the screen to show.
            ctl.delay(20);
            gMustClearDevice = true;
        });
        symbolTable.addNativeFunction("CloseGraph", Node.voidType, [], function (ctl) {
            $canvas.hide();
        });
        symbolTable.addNativeFunction("SetWriteMode", Node.voidType, [Node.integerType],
                                      function (ctl) {
            // This is not documented in the reference books.
        });

        // Image read/write functions.
        symbolTable.addNativeFunction("ImageSize", Node.integerType,
                                      [Node.integerType, Node.integerType,
                                          Node.integerType, Node.integerType],
                                      function (ctl, x1, y1, x2, y2) {
           var width = x2 - x1 + 1;
           var height = y2 - y1 + 1;

           // Two words for width/height.
           return width*height + 2;
        });
        symbol = symbolTable.addNativeFunction("GetImage", Node.voidType,
                                      [Node.integerType, Node.integerType,
                                          Node.integerType, Node.integerType, Node.voidType],
                                      function (ctl, x1, y1, x2, y2, bitmap) {

           var width = x2 - x1 + 1;
           var height = y2 - y1 + 1;
           var data = gCtx.getImageData(x1, y1, width, height).data;

           // Store width and height.
           ctl.writeDstore(bitmap++, width);
           ctl.writeDstore(bitmap++, height);

           // Store all pixels.
           for (var i = 0; i < width*height; i++) {
               // The data we get is RGBA.
               ctl.writeDstore(bitmap++, rgbToIndex(data, i*4));
           }
        });
        symbol.type.parameters[4].byReference = true;
        symbol = symbolTable.addNativeFunction("PutImage", Node.voidType,
                                      [Node.integerType, Node.integerType,
                                          Node.voidType, Node.integerType],
                                      function (ctl, x, y, bitmap, bitblt) {

           // Read width and height.
           var width = ctl.readDstore(bitmap++);
           var height = ctl.readDstore(bitmap++);

           var imageData;
           var data;
           if (bitblt === cNormalPut || bitblt === cNotPut) {
               // Create blank image.
               imageData = gCtx.createImageData(width, height);
           } else {
               // Get existing data from screen.
               imageData = gCtx.getImageData(x, y, width, height);
           }
           data = imageData.data;

           // Load all pixels.
           for (var i = 0; i < width*height; i++) {
               var color = ctl.readDstore(bitmap++);
               switch (bitblt) {
                   case cNormalPut:
                       // Nothing.
                       break;
                   case cXORPut:
                       // XOR with existing data.
                       color = (color ^ rgbToIndex(data, i*4)) & 0x0F;
                       break;
                   case cOrPut:
                       // Or with existing data.
                       color = (color | rgbToIndex(data, i*4)) & 0x0F;
                       break;
                   case cAndPut:
                       // And with existing data.
                       color = (color & rgbToIndex(data, i*4)) & 0x0F;
                       break;
                   case cNotPut:
                       // Invert source data.
                       color = ~color & 0x0F;
                       break;
               }
               var rgb = RGB_COLORS[color];
               data[i*4 + 0] = rgb[0];
               data[i*4 + 1] = rgb[1];
               data[i*4 + 2] = rgb[2];
               data[i*4 + 3] = 255;
           }

           gCtx.putImageData(imageData, x, y);
        });
        symbol.type.parameters[2].byReference = true;

        // Text functions.
        symbolTable.addNativeFunction("SetTextJustify", Node.voidType,
                                      [Node.integerType, Node.integerType],
                                      function (ctl, horizontal, vertical) {

            gTextHorizontalAlign = horizontal;
            gTextVerticalAlign = vertical;
        });
        symbolTable.addNativeFunction("SetTextStyle", Node.voidType,
                                      [Node.integerType, Node.integerType, Node.integerType],
                                      function (ctl, font, direction, charSize) {

            gTextFont = font;
            gTextDirection = direction;
            gTextSize = charSize;
        });
        symbolTable.addNativeFunction("OutTextXY", Node.voidType,
                                      [Node.integerType, Node.integerType, Node.stringType],
                                      function (ctl, x, y, text) {

            gCtx.fillStyle = COLORS[gCurrentColor];
            var metrics = gCtx.measureText(text);
            gCtx.font = (gTextSize*8) + "px sans-serif";
            switch (gTextHorizontalAlign) {
                case 0: gCtx.textAlign = "left"; break;
                case 1: gCtx.textAlign = "center"; break;
                case 2: gCtx.textAlign = "right"; break;
            }
            switch (gTextVerticalAlign) {
                case 0: gCtx.textBaseline = "bottom"; break;
                case 1: gCtx.textBaseline = "middle"; break;
                case 2: gCtx.textBaseline = "top"; break;
            }
            gCtx.fillText(text, x, y);
        });
    };

    return {
        importSymbols: importSymbols
    };
});
