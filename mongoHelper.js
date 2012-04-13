var Db = require('mongodb').Db,
    Server = require('mongodb').Server;
var db = null;

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

    if (db === null) {
        var dbo = new Db(
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
                initcb(err);
            } else {
                db = tdb;
                initcb(null, db);
            }
        });
    } else {
        initcb(null, db);
    }
};

module.exports.open = connectToDb;
