var fs = require('fs'),
    mime = require('mime-magic'),
    crypto = require('crypto'),
    mongoHelper = require('./mongoHelper.js'),
    Server = require('mongodb').Server,
    Collection = require('mongodb').Collection,
    GridStore = require('mongodb').GridStore,
    ReplSetServers = require('mongodb').ReplSetServers,
    ObjectID = require('mongodb').ObjectID,
    Binary = require('mongodb').Binary,
    GridStore = require('mongodb').GridStore,
    Code = require('mongodb').Code,
    BSON = require('mongodb').pure().BSON
    cacheSize = 1000,
    cacheMap = {},
    cacheList = new Array(cacheSize),
    cachePos = 0,
    cacheFull = false;

var rootCollection = 'parasoup';

module.exports = function(options, initcb) {
    var db, collection;
    if (!options) {
        initcb(new Error('missing options'));
        return;
    }

    var sanitizeFileName = function(filename) {
        return encodeURIComponent(filename);
    };

    var addToCache = function(filename, data, contentType) {
        if (cacheMap.hasOwnProperty(filename)) {
            return;
        }

        var item = {
            filename: filename,
            contentType: contentType,
            data: data
        };

        if (cacheFull) {
            delete cacheMap[cacheList[cachePos].filename];
        }
        cacheList[cachePos] = item;
        cacheMap[filename] = cachePos;
        cachePos++;

        if (cachePos >= cacheSize) {
            cachePos = 0;
            cacheFull = true;
        }
    };

    var getFromCache = function(filename) {
        if (!cacheMap.hasOwnProperty(filename)) {
            return undefined;
        } else {
            var item = cacheList[cacheMap[filename]];
            return item;
        }
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
            'r',
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
            'w',
            {
                root: rootCollection,
                'content_type': contentType,
                'chunk_size': 1024 * 1024,
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

    var readFileAndTypeFromDb = function(filename, cb, prefetch) {
        var data = getFromCache(filename);
        if (data !== undefined) {
            prefetch || options.stats.cacheHits++;
            cb(null, data.data, data.contentType);
            return prefetch || increaseAccessCount(filename);
        }
        var start = new Date();
        return openDbFileRead(filename, function(gs) {
            gs.read(function(err, data) {
                if (err) {
                    options.logger.error('gridstoreRead ' + filename, err);
                    cb(err);
                } else {
                    getTypeFromGridStore(gs, function(err, type) {
                        if (err) {
                            options.logger.error('gettypeFromGridStore ' + filename, err);
                            cb(err);
                        } else {
                            var diff = Math.floor(( new Date() ) - start);
                            if (!prefetch && diff > 500) {
                                options.logger.info('query for ' + filename + ' took ' + diff + 'ms');
                            }
                            var buf = new Buffer(data);
                            cb(null, buf, type);
                            gs.close(function() {
                                addToCache(filename, buf, type);
                                prefetch || increaseAccessCount(filename);
                            });
                        }
                    });
                }
            });
        });
    };

    var increaseAccessCount = function(filename) {
        collection.update({ 'filename': filename }, { $inc: { 'metadata.accessCount': 1 }, $set: { 'metadata.access': new Date()} });
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
        cb(!contentType ? new Error('file not found') : null, contentType);
    };

    var updateStats = function() {
        collection.find({}).count(function(err, count) {
            if (!err) {
                options.stats.assetCount = count;
            }
        });
    };

    var getPopularFilenames = function(count, cb) {
        var targetDate = new Date();
        targetDate.setDate(-30);

        collection.find({ length: { $gt: 100000 }, uploadDate: { $gt: targetDate }}).
            sort({ 'metadata.accessCount': -1 }).
            limit(count).toArray(function(err, data) {
            if (err) {
                return cb(err);
            }


            data = data.map(function(file) {
                return {
                    path: decodeURIComponent(file.filename),
                    count: file.metadata.accessCount
                };
            });

            cb(null, data);
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
                    cb = cb || function() {};
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
                    cb = cb || function() {};
                    var cacheName = sanitizeFileName(filename);
                    fileExistsInDb(cacheName, function(err, exists) {
                        if (err) {
                            cb(err);
                        } else if (!exists) {
                            cb(new Error('file not found'));
                        } else {
                            getMimeTypeFromDb(cacheName, cb);
                        }
                    });
                },
                getFileBufferAndType: function(filename, cb) {
                    cb = cb || function() {};
                    var cacheName = sanitizeFileName(filename);
                    fileExistsInDb(cacheName, function(err, exists) {
                        if (err) {
                            cb(err);
                        } else if (!exists) {
                            cb(new Error('file not found'));
                        } else {
                            readFileAndTypeFromDb(cacheName, cb);
                        }
                    });
                },
                getPopularFiles: function(count, cb) {
                    cb = cb || function() {};
                    count = count || 100;
                    getPopularFilenames(count, cb);
                },
                prefetchFile: function(filename, cb) {
                    cb = cb || function() {};
                    var cacheName = sanitizeFileName(filename);
                    fileExistsInDb(cacheName, function(err, exists) {
                        if (err) {
                            cb(err);
                        } else if (!exists) {
                            cb(new Error('file not found'));
                        } else {
                            readFileAndTypeFromDb(cacheName, cb, true);
                        }
                    });
                }
            };
            initcb(null, api);
        }
    });
};
