var fs = require('fs'),
    mime = require('mime-magic'),
    crypto = require('crypto'),
    mongoHelper = require("./mongoHelper.js"),
    Server = require('mongodb').Server,
    Collection = require('mongodb').Collection,
    GridStore = require('mongodb').GridStore,
    ReplSetServers = require('mongodb').ReplSetServers,
    ObjectID = require('mongodb').ObjectID,
    Binary = require('mongodb').Binary,
    GridStore = require('mongodb').GridStore,
    Code = require('mongodb').Code,
    BSON = require('mongodb').pure().BSON;

var rootCollection = "parasoup";

module.exports = function(options, initcb) {
    var db, collection;
    if (!options) {
        initcb(new Error("missing options"));
        return;
    }

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
                access: new Date(),
                accessCount: 1
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
                    getTypeFromGridStore(gs, function(err, type) {
                        if (err) {
                            cb(err);
                        } else {
                            gs.close(function() {
                                cb(null, new Buffer(data), type);
                                gs.collection(function(err, collection) {
                                    if (!err) {
                                        increaseAccessCount(filename, collection);
                                    }
                                });
                            });
                        }
                    });
                }
            });
        });
    };

    var increaseAccessCount = function(filename, collection) {
        collection.update({ "filename": filename }, { $inc: { "metadata.accessCount": 1 } });
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

    var updateStats = function() {
        collection.find({}).count(function(err, count) {
            if (!err) {
                options.stats.assetCount = count;
            }
        });
    };

    mongoHelper.open(options, function(err, tdb) {
        if (err) {
            initcb(err);
        } else {
            db = tdb;
            collection = new Collection(db, 'parasoup.files');
            updateStats();
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
                    updateStats();
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
