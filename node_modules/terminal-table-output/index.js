var _output = (function() {

    var _opts,
        _lineDelimiter = "{{line}}",
        
        _fillString = function(str, len, char) {
                while (str.length < len) {
                str += char;
            }
            return str;
        },

        _isLine = function(str) {
            if (typeof str === "string") {
                return (str.substr(0, 8) === _lineDelimiter);
            }
            return false;
        },

         _getLineChar = function(str) {
            if (str.substr(0, 8) === _lineDelimiter) {
                if (str.length > 8) {
                    return str.substr(8, str.length);
                } else {
                    return _opts.line;
               }
            }
            return false;
        };

    var _inst = function(opts) {
        _opts = opts || {
            fill: " ",
            border: " | ",
            line: "="
        };
        return {
            output: [],
            output_print: null,

            reset: function() {
                this.output = [];
                return this;
            },

            pushrow: function(arr) {
                this.output.push(arr);
                return this;
            },

            row: function() {
                this.output.push([]);
                return this;
            },

            col: function(s) {
                if (this.output.length === 0) {
                    this.output.push([]);
                }
                if (typeof this.output[this.output.length-1] === "string") {
                    this.output.push([]);
                }
                this.output[this.output.length-1].push(s);
                return this;
            },

            line: function(linegfx) {
                this.output.push(_lineDelimiter + (linegfx ? linegfx : ""));
                return this;
            },

            print: function(print) {
                // Validate columns and rows
                // Make a deep copy of output data
                var o, i, len, j, jlen;
                this.output_print = o = JSON.parse(JSON.stringify(this.output));
                // Make everything a string
                // And check longest item in each column
                var col_length = [];
                for(i = 0, len = o.length; i < len; i++) {
                    if (!_isLine(o[i])) {
                        for (j = 0, jlen = o[i].length; j < jlen; j++) {
                            o[i][j] += "";
                            if (!col_length[j]) col_length[j] = 0;
                            if (col_length[j] < o[i][j].length) {
                                col_length[j] = o[i][j].length;
                            }
                        }
                    }
                }

                var total_width = 0;
                col_length.forEach(function(val) {
                    total_width += val + _opts.border.length;
                });

                var str = "",
                    lchar;
                for(i = 0, len = o.length; i < len; i++) {
                    if (!_isLine(o[i])) {
                        for (j = 0, jlen = o[i].length; j < jlen; j++) {
                            str += _fillString(o[i][j], col_length[j], _opts.fill) + _opts.border;
                        }
                    } else {
                        lchar = _getLineChar(o[i]); 
                        str += Array(Math.round(total_width/lchar.length)).join(lchar);
                    }
                    str += "\n"
                }
                if (print) {
                    console.log(str);
                } else {
                    return str;
                }
            },

            export: function() {



            }
        };
    };

    return {
        create: function(opts) {
            return _inst(opts);
        }
    };
})();

module.exports = _output;
