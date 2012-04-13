var fs = require("fs"),
    mime = require("./mimeTypeHelper.js"),
    Cache = require("./mongocache.js");
var a = {};
var options = { mongodb: { host: '127.0.0.1', port: 27017 } };
console.log("connecting");
var cache = new Cache(options, function(err, api) {
    if (err) {
        throw err;
    } else {
        console.log("connected");
        var data = "<html></html>";
        mime.getBufferMimeType(new Buffer(data), function(err, type) {
            if (err) {
                throw err;
            } else {
                console.log("write type: " + type);
                api.insertFileBuffer(
                    "testfile2.txt",
                    data,
                    type,
                    function() {
                        console.log("write done");
                        api.getFileBufferAndType(
                            "testfile2.txt",
                            function(err, data, type) {
                                if (err) {
                                    console.log(err.message);
                                    console.log(err.stack);
                                } else {
                                    console.log("read: " + data);
                                    console.log("read type: " + type);
                                    console.log("win");
                                    process.exit(0);
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


module.exports = a;
