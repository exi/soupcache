var fs = require('fs'),
    async = require('async'),
    util = require('util'),
    dateFormat = require('dateformat'),
    Logger = function(options, callback) {
        this.accesslog = options.accesslog;
        this.errorlog = options.errorlog;
        this.infolog = options.infolog;
        var that = this;

        initFiles();

        function initFiles() {
            async.parallel([
                    createStream('accessStream', that.accesslog),
                    createStream('errorStream', that.errorlog),
                    createStream('infoStream', that.infolog)
                    ], postStreamCreation);
        }

        function createStream(attrib, filename) {
            return function(cb) {
                that[attrib] = fs.createWriteStream(filename, {
                    flags: 'a',
                    mode: '0755',
                    encoding: 'utf8'
                });

                that[attrib].on('open', function(err, fd) {
                    if (err) {
                        console.error(err.message);
                        console.error(err.stack);
                    }
                    console.log('stream ' + filename + ' open');
                    return cb(null);
                });
            };
        }

        function postStreamCreation(err) {
            return callback(err);
        }
    };

Logger.prototype.error = function(action, err) {
    this.errorStream.write(this.getLogDate() + ' ' + action + '\n');
    if (err) {
        this.errorStream.write(err.message + '\n');
        this.errorStream.write(err.stack + '\n');
    }
}

Logger.prototype.access = function(request, httpStatus, dataLength) {
    if (request && request.method && request.url && request.httpVersion) {
        var connectionLine = [request.method, request.url, 'HTTP/' + request.httpVersion].join(' ');
        var virtualhost = "parasoup.de";
        var userAgent = "-";
        var referer = "-";

        if (request.headers) {
            virtualhost = request.headers.host || virtualhost;
            userAgent = request.headers['user-agent'] ? '[' + request.headers['user-agent'] + ']' : userAgent;
            referer = request.headers['referer'] || referer;
        }

        var parts = [
            request.connection.remoteAddress || "0.0.0.0",
            "-",
            "-",
            this.getLogDate(),
            '"' + connectionLine + '"',
            httpStatus,
            dataLength || 0,
            virtualhost,
            userAgent,
            referer
        ];
        this.accessStream.write(parts.join(" ") + '\n');
    }
}

Logger.prototype.info = function(msg) {
    this.infoStream.write(this.getLogDate() + ' ' + msg + '\n');
}

Logger.prototype.console = function(msg) {
    console.log('console: ', msg);
}

Logger.prototype.getLogDate = function() {
    var datestring = dateFormat(new Date(), "dd/mmm/yyyy:HH:MM:ss o");
    return '[' + datestring + ']';
}

module.exports = Logger;
