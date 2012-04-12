var fs = require("fs"),
    mime = require("./mimeTypeHelper.js");
var a = {};
var Cache = require("./mongocache.js");
var cache = new Cache(
    {
        mongodb: {
            host: '127.0.0.1',
            port: 27017
        }
    },
    function(err, api) {
        if (err) {
            throw err;
        } else {
            console.log("connected");
            var data = "<html></html>";
            mime.getBufferMimeType(new Buffer(data), function(err, type) {
                if (err) {
                    throw err;
                } else {
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
                                        console.log("type: " + type);
                                    }
                                }
                            );
                        }
                    );
                }
            });
            a.api = api;
        }
    }
);

module.exports = a;
