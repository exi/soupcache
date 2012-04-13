var Db = require('mongodb').Db,
    Server = require('mongodb').Server;
var dbs = {};

var connectToDb = function(options, initcb) {
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

    if (!dbs[options.mongodb.host]) {
        dbs[options.mongodb.host] = {};
    }

    if (!dbs[options.mongodb.host][options.mongodb.port]) {
        var dbo = new Db(
            'parasoup',
            new Server(
                options.mongodb.host,
                options.mongodb.port,
                { auto_reconnect: true, poolSize: 1 }
            ),
            { native_parser: false }
        );

        dbo.open(function(err, db) {
            if (err) {
                initcb(err);
            } else {
                dbs[options.mongodb.host][options.mongodb.port] = db;
                initcb(null, db);
            }
        });
    } else {
        initcb(null, dbs[options.mongodb.host][options.mongodb.port]);
    }
};

module.exports.open = connectToDb;
