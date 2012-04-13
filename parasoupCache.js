var mongoHelper = require("./mongoHelper.js"),
    Collection = require('mongodb').Collection;

var createCache = function(options, initcb) {
    if (!options) {
        initcb(new Error("missing options"));
        return;
    }

    var db;
    var collection;

    mongoHelper.open(options, function(err, tdb) {
        if (err) {
            initcb(err);
        } else {
            db = tdb;
            collection = new Collection(db, 'parasoup.cache');
            var api = {
                getAndRemoveItem: function(cb) {
                    collection.find({}).limit(1000).count(function(err, count) {
                        if (err) {
                            cb(err);
                        } else if (count === 0) {
                            cb(null, null);
                        } else {
                            var randomNumber = Math.floor(Math.random() * count);
                            collection.find(
                                {},
                                {
                                    "_id": 1,
                                    "filename": 1
                                }
                            ).limit(1)
                            .skip(randomNumber).nextObject(
                                function(err, doc) {
                                    if (err) {
                                        cb(err);
                                    } else {
                                        collection.remove(
                                            { "_id": doc._id },
                                            function() {
                                                cb(null, doc.filename);
                                            }
                                        );
                                    }
                                }
                            );
                        }
                    });
                },
                insert: function(filename, cb) {
                    collection.update(
                        { filename: filename },
                        { $set: { filename: filename } },
                        { upsert: true, safe: true },
                        function(err) {
                            cb(err);
                        }
                    );
                },
                size: function(cb) {
                    collection.find({}).count(cb);
                }
            };
            initcb(null, api);
        }
    });
};

module.exports = createCache;
