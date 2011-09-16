var url = require('url'),
    http = require('http'),
    cache = require('cache.js'),
    util = require('util');

var assetDownload = function(mirror, url, options, callback) {
    var that = this;

    var mirrors = [mirror];
    var currentMirror = "";
    var tries = 0;
    var fileBuffer = null;
    var fileWritten = 0;
    var fileSize = 0;
    var idleDate = new Date();
    var soupRequest = null;

    var fetchFileAndFinish = function() {
        var mirror = getMirror();;
        currentMirror = mirror;

        soupRequest = http.get({
                host: mirror,
                port: 80,
                path: url
            },
            onFetchResponse);
        soupRequest.on('error', onError);
        soupRequest.setTimeout(options.timeout, onRequestTimeout);
    }

    var getMirror = function() {
        return mirrors[tries % mirrors.length];
    }

    var onFetchResponse = function(res) {
        res.setEncoding('binary');
        var contentLength = parseInt(res.headers['content-length']);
        fileSize = contentLength;
        fileBuffer = new Buffer(contentLength);
        res.on('error', onError);
        res.on('data', onFileData);
        res.on('end', onFileEnd);
    }

    var onRequestTimeout = function() {
        console.log("timeout...retry");
        fetchFileAndFinish();
    }

    var onError = function(error) {
        console.trace();
        console.log("error: " + error.message);
        tries++;
        console.log("retry(" + tries + ")");
        setTimeout(fetchFileAndFinish, 500);
    };

    var onFileData = function(chunk) {
        fileBuffer.write(chunk, fileWritten, 'binary');
        fileWritten += Buffer.byteLength(chunk, 'binary');
        idleDate = new Date();
    }

    var onFileEnd = function() {
        finish();
    }


    var finish = function() {
        var newbuf = new Buffer(fileBuffer).slice(0, fileWritten);
        callback(url, newbuf);
    };

    that.getStatus = function() {
        var waitingTime = (Date.parse(new Date()) - Date.parse(idleDate)) / 1000;
        waitingTime = Math.floor(waitingTime / 10) * 10;
        return currentMirror + url + " \t" + (tries + 1) + " tries \t" +
            waitingTime + "s \t" + fileWritten + "/" + fileSize + " \t" + that.getStatusBar();
    }

    that.getStatusBar = function() {
        var bar = "[";
        if (fileSize > 0) {
            for (var pos = 0; pos < 20; pos++) {
                if ((fileWritten / fileSize) * 20 >= pos) {
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

    that.addMirror = function(host) {
        mirrors.push(host);
    }

    fetchFileAndFinish();
};

module.exports = assetDownload;
