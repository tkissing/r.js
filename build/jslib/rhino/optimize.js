/**
 * @license Copyright (c) 2010-2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */

/*jslint strict: false, plusplus: false */
/*global define: false, java: false, Packages: false */

define(['logger', 'env!env/file'], function (logger, file) {

    //Add .reduce to Rhino so UglifyJS can run in Rhino,
    //inspired by https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/reduce
    //but rewritten for brevity, and to be good enough for use by UglifyJS.
    if (!Array.prototype.reduce) {
        Array.prototype.reduce = function (fn /*, initialValue */) {
            var i = 0,
                length = this.length,
                accumulator;

            if (arguments.length >= 2) {
                accumulator = arguments[1];
            } else {
                do {
                    if (i in this) {
                        accumulator = this[i++];
                        break;
                    }
                }
                while (true);
            }

            for (; i < length; i++) {
                if (i in this) {
                    accumulator = fn.call(undefined, accumulator, this[i], i, this);
                }
            }

            return accumulator;
        };
    }

    var JSSourceFilefromCode, optimize;

    //Bind to Closure compiler, but if it is not available, do not sweat it.
    try {
        JSSourceFilefromCode = java.lang.Class.forName('com.google.javascript.jscomp.JSSourceFile').getMethod('fromCode', [java.lang.String, java.lang.String]);
    } catch (e) {}

    //Helper for closure compiler, because of weird Java-JavaScript interactions.
    function closurefromCode(filename, content) {
        return JSSourceFilefromCode.invoke(null, [filename, content]);
    }

    optimize = {
        closure: function (fileName, fileContents, keepLines, config) {
            config = config || {};
            var jscomp = Packages.com.google.javascript.jscomp,
                flags = Packages.com.google.common.flags,
                //Fake extern
                externSourceFile = closurefromCode("fakeextern.js", " "),
                //Set up source input
                jsSourceFile = closurefromCode(String(fileName), String(fileContents)),
                options, option, FLAG_compilation_level, compiler,
                Compiler = Packages.com.google.javascript.jscomp.Compiler,
                result, mappings, baseName;

            logger.trace("Minifying file: " + fileName);

            baseName = (new java.io.File(fileName)).getName();

            //Set up options
            options = new jscomp.CompilerOptions();
            for (option in config.CompilerOptions) {
                // options are false by default and jslint wanted an if statement in this for loop
                if (config.CompilerOptions[option]) {
                    options[option] = config.CompilerOptions[option];
                }

            }
            options.prettyPrint = keepLines || options.prettyPrint;

            FLAG_compilation_level = jscomp.CompilationLevel[config.CompilationLevel || 'SIMPLE_OPTIMIZATIONS'];
            FLAG_compilation_level.setOptionsForCompilationLevel(options);

            if (config.generateSourceMaps) {
                mappings = new java.util.ArrayList();

                mappings.add(new com.google.javascript.jscomp.SourceMap.LocationMapping(fileName, baseName + ".src"));
                options.setSourceMapLocationMappings(mappings);
                options.setSourceMapOutputPath(fileName + ".map");
            }

            //Trigger the compiler
            Compiler.setLoggingLevel(Packages.java.util.logging.Level[config.loggingLevel || 'WARNING']);
            compiler = new Compiler();

            result = compiler.compile(externSourceFile, jsSourceFile, options);
            if (result.success) {
                fileContents = compiler.toSource();

                return config.generateSourceMaps ? {sourceMap: result.sourceMap, toSource: function() { return fileContents; }} : fileContents;
            } else {
                logger.error('Cannot closure compile file: ' + fileName + '. Skipping it.');
            }

            return fileContents;
        }
    };

    return optimize;
});