var fs = require('fs'),
    mime = require('mime-magic'),
    crypto = require('crypto'),
    Db = require('mongodb').Db,
    Server = require('mongodb').Server,
    GridStore = require('mongodb').GridStore,
    ReplSetServers = require('mongodb').ReplSetServers,
    ObjectID = require('mongodb').ObjectID,
    Binary = require('mongodb').Binary,
    GridStore = require('mongodb').GridStore,
    Code = require('mongodb').Code,
    BSON = require('mongodb').pure().BSON;

var rootCollection = "parasoup";

module.exports = function(options, initcb) {
    var dbo, db;
    if (!options) {
        initcb(new Error("missing options"));
        return;
    }
    if (!options.mongodb) {
        initcb(new Error("missing mongodb settings"));
        return;
    }
    if (!options.mongodb.host) {
        initcb(new Error("missing mongodb host"));
        return;
    }
    if (!options.mongodb.port) {
        initcb(new Error("missing mongodb port"));
        return;
    }

    var connectDb = function(cb) {
        dbo = new Db(
            'parasoup',
            new Server(
                options.mongodb.host,
                options.mongodb.port,
                { auto_reconnect: true, poolSize: 1 }
                ),
            { native_parser: false }
        );
        dbo.open(function(err, tdb) {
            if (err) {
                cb(err);
            } else {
                db = tdb;
                cb();
            }
        });
    };

    var sanitizeFileName = function(filename) {
        return encodeURIComponent(filename);
    };

    var fileExistsInDb = function(filename, cb) {
        GridStore.exist(
            db,
            filename,
            rootCollection,
            cb
        );
    };

    var openDbFileRead = function(filename, cb) {
        var gridstore = new GridStore(
            db,
            filename,
            "r",
            {
                root: rootCollection
            }
        );

        gridstore.open(function(err, gs) {
            cb(gs);
        });
    };

    var openDbFileWrite = function(filename, contentType, metadata, cb) {
        console.log("type: " + contentType);
        var gridstore = new GridStore(
            db,
            filename,
            "w",
            {
                root: rootCollection,
                "content_type": contentType,
                "chunk_size": 1024 * 1024,
                metadata: metadata
            }
        );

        gridstore.open(function(err, gs) {
            cb(gs);
        });
    };

    var insertBufferIntoDb = function(buffer, filename, mimeType, cb) {
        openDbFileWrite(
            filename,
            mimeType,
            {
                access: new Date()
            },
            function(gridstore) {
                gridstore.write(
                    buffer,
                    function(err, result) {
                        if (err) {
                            cb(err);
                        } else {
                            gridstore.close(cb);
                        }
                    }
                );
            }
        );
    };

    var readFileAndTypeFromDb = function(filename, cb) {
        openDbFileRead(filename, function(gs) {
            gs.read(function(err, data) {
                if (err) {
                    cb(err);
                } else {
                    console.log("fileaccess to: " + filename);
                    getTypeFromGridStore(gs, function(err, type) {
                        if (err) {
                            cb(err);
                        } else {
                            gs.close(function() {
                                cb(null, new Buffer(data), type);
                            });
                        }
                    });
                }
            });
        });
    };

    var getMimeTypeFromDb = function(filename, cb) {
        openDbFileRead(filename, function(gs) {
            getTypeFromGridStore(gs, function(err, type) {
                gs.close(function() {
                    cb(err, type);
                });
            });
        });
    };

    var getTypeFromGridStore = function(gs, cb) {
        var contentType = gs && gs.contentType ? gs.contentType : null;
        cb(!contentType ? new Error("file not found") : null, contentType);
    };

    connectDb(function(err) {
        if (err) {
            initcb(err);
        } else {
            var api = {
                insertFileBuffer: function(filename, buffer, mimeType, cb) {
                    var cacheName = sanitizeFileName(filename);
                    insertBufferIntoDb(
                        buffer,
                        cacheName,
                        mimeType,
                        function(err) {
                            cb(err);
                        }
                        );
                },
                getFileMimeType: function(filename, cb) {
                    var cacheName = sanitizeFileName(filename);
                    fileExistsInDb(cacheName, function(err, exists) {
                        if (err) {
                            cb(err);
                        } else if (!exists) {
                            cb(new Error("file not found"));
                        } else {
                            getMimeTypeFromDb(cacheName, function(err, type) {
                                cb(err, type);
                            });
                        }
                    });
                },
                getFileBufferAndType: function(filename, cb) {
                    var cacheName = sanitizeFileName(filename);
                    fileExistsInDb(cacheName, function(err, exists) {
                        if (err) {
                            cb(err);
                        } else if (!exists) {
                            cb(new Error("file not found"));
                        } else {
                            readFileAndTypeFromDb(cacheName, cb);
                        }
                    });
                }
            };
            initcb(null, api);
        }
    });
};
