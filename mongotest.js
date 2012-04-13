var fs = require("fs"),
    mime = require("./mimeTypeHelper.js"),
    Pcache = require("./parasoupCache.js"),
    Cache = require("./mongocache.js");
var a = {};
var options = { mongodb: { host: '127.0.0.1', port: 27017 } };

var printError = function(err) {
    console.log(err.message);
    console.log(err.stack);
};

console.log("connecting");
var fileName = "" + parseInt(Math.random() * 1000) + "test.txt";
var pcache = new Pcache(options, function(err, pcache) {
    if (err) {
        printError(err);
    } else {
        var cache = new Cache(options, function(err, api) {
            if (err) {
                printError(err);
            } else {
                console.log("connected");
                var data = "<html></html>";
                mime.getBufferMimeType(new Buffer(data), function(err, type) {
                    if (err) {
                        printError(err);
                    } else {
                        console.log("write type: " + type);
                        api.insertFileBuffer(
                            fileName,
                            data,
                            type,
                            function() {
                                console.log("write done");
                                api.getFileBufferAndType(
                                    fileName,
                                    function(err, data, type) {
                                        if (err) {
                                            printError(err);
                                        } else {
                                            console.log("read: " + data);
                                            console.log("read type: " + type);
                                            pcache.insert(fileName, function(err, file) {
                                                if (err) {
                                                    printError(err);
                                                } else {
                                                    console.log("inserted " + fileName);
                                                    pcache.getAndRemoveItem(function(err, file) {
                                                        if (err) {
                                                            printError(err);
                                                        } else {
                                                            console.log("got " + file);
                                                            process.exit(0);
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    }
                                );
                            }
                        );
                    }
                });
                a.api = api;
            }
        });
    }
});


module.exports = a;
