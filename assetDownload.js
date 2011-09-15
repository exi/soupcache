var url = require('url'),
    http = require('http'),
    cache = require('cache.js'),
    util = require('util');

var assetDownload = function(mirror, url, options, callback) {
    var that = this;

    that.mirrors = [mirror];
    that.currentMirror = "";
    that.options = options;
    that.url = url;
    that.callback = callback;
    that.tries = 0;
    that.fileBuffer = null;
    that.fileWritten = 0;
    that.fileSize = 0;

    that.finish = function() {
        var newbuf = new Buffer(that.fileBuffer).slice(0, that.fileWritten);
        that.callback(that.url, newbuf);
    };

    that.getMirror = function() {
        return that.mirrors[that.tries % that.mirrors.length];
    }

    that.getStatus = function() {
        return that.currentMirror + that.url + " " + (that.tries + 1) + " tries " +
            that.fileWritten + "/" + that.fileSize + " " + that.getStatusBar();
    }

    that.getStatusBar = function() {
        var bar = "[";
        if (that.fileSize > 0) {
            for (var pos = 0; pos < 20; pos++) {
                if ((that.fileWritten / that.fileSize) * 20 >= pos) {
                    bar += "#";
                } else {
                    bar += " ";
                }
            }
        } else {
            bar += "?/?";
        }
        bar += "]";
        return bar;
    }

    that.onFetchResponse = function(res) {
        res.setEncoding('binary');
        var contentLength = parseInt(res.headers['content-length']);
        that.fileSize = contentLength;
        that.fileBuffer = new Buffer(contentLength);
        res.on('error', that.onError);
        res.on('data', that.onFileData);
        res.on('end', that.onFileEnd);
    }

    that.onRequestTimeout = function() {
        console.log("timeout...retry");
        that.fetchFileAndFinish();
    }

    that.onError = function(error) {
        console.trace();
        console.log("error: " + error.message);
        console.log("retry");
        that.tries++;
        that.fetchFileAndFinish();
    };

    that.onFileData = function(chunk) {
        that.fileBuffer.write(chunk, that.fileWritten, 'binary');
        that.fileWritten += Buffer.byteLength(chunk, 'binary');
    }

    that.onFileEnd = function() {
        that.finish();
    }

    that.addMirror = function(host) {
        that.mirrors.push(host);
    }

    that.fetchFileAndFinish = function() {
        var mirror = that.getMirror();;
        that.currentMirror = mirror;

        that.soupRequest = http.get({
            host: mirror,
            port: 80,
            path: that.url
        },
        that.onFetchResponse);
        that.soupRequest.on('error', that.onError);
        that.soupRequest.setTimeout(that.options.timeout, that.onRequestTimeout);
    }

    that.fetchFileAndFinish();
};

module.exports = assetDownload;
