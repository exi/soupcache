var Url = require('url'),
    http = require('http'),
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
    var statusCode = 200;
    var originalUrl = url;
    var redirects = 0;
    var maxRedirects = 10;

    var resetValues = function() {
        fileSize = 0;
        fileWritten = 0;
        fileBuffer = null;
        tries = null;
        soupRequest = null;
    };

    var fetchFileAndFinish = function() {
        resetValues();
        var mirror = getMirror();
        currentMirror = mirror;

        soupRequest = http.get({
                host: mirror,
                port: 80,
                path: url
            },
            onFetchResponse);
        soupRequest.on('error', onError);
    };

    var getMirror = function() {
        return mirrors[tries % mirrors.length];
    };

    var getUrl = function(href) {
        var newUrl = Url.parse(href);
        return newUrl.pathname + (newUrl.search || '');
    };

    var getHostname = function(href) {
        var newUrl = Url.parse(href);
        return newUrl.hostname;
    };

    var onFetchResponse = function(res) {
        if (res.statusCode >= 300 && res.statusCode < 400) {
            if (originalUrl == getUrl(res.headers.location)) {
                console.error("endless redirect detected...");
                errorFinish();
            } else if (redirects < maxRedirects) {
                var location = res.headers.location;

                url = getUrl(location);
                mirrors = [getHostname(location)];

                redirects++;
                options.stats.redirects++;

                fetchFileAndFinish();
            } else {
                console.error("aborting asset request because of too many redirects");
                soupRequest.abort();
                errorFinish();
            }
        } else {
            res.setEncoding('binary');
            var contentLength = parseInt(res.headers['content-length']);
            fileSize = contentLength;
            statusCode = res.statusCode;
            res.on('error', onError);
            res.on('data', onFileData);
            res.on('end', onFileEnd);
        }
    };

    var onRequestTimeout = function() {
        console.log("timeout...retry");
        fetchFileAndFinish();
    };

    var onError = function(error) {
        console.error("error: " + error.message);
        tries++;
        console.error("retry(" + tries + ") " + url);
        setTimeout(fetchFileAndFinish, 500);
    };

    var onFileData = function(chunk) {
        if (fileBuffer === null) {
            fileBuffer = new Buffer(fileSize);
        }

        try {
            fileBuffer.write(chunk, fileWritten, 'binary');
            fileWritten += Buffer.byteLength(chunk, 'binary');
            idleDate = new Date();
        } catch (e) {
            console.error("error: " + e.message);
            console.error(e.stack);
            console.error("fileWritten: " + fileWritten);
            console.error("fileSize: " + fileSize);
            console.error("bufferlength: " + fileBuffer.length);
            errorFinish();
        }
    };

    var onFileEnd = function() {
        finish();
    };

    var finish = function() {
        if (fileBuffer === null) {
            errorFinish();
        } else {
            try {
                var newbuf = new Buffer(fileBuffer).slice(0, fileWritten);
                callback(originalUrl, newbuf, statusCode);
            } catch (e) {
                console.error("error: " + e.message);
                console.error(e.stack);
                errorFinish();
            }
        }
    };

    var errorFinish = function() {
        console.error("errorFinish");
        console.trace();
        var newbuf = new Buffer(0);
        callback(originalUrl, newbuf, 500);
    };

    that.getStatus = function() {
        var waitingTime = (Date.parse(new Date()) - Date.parse(idleDate)) / 1000;
        waitingTime = Math.floor(waitingTime / 10) * 10;
        var mirrorsString = "[" + mirrors.join(",") + "]";
        return currentMirror + url + " \t" + (tries + 1) + " tries \t" +
            waitingTime + "s \t" + fileWritten + "/" + fileSize + " \t mirrors:" + mirrorsString + "\t" + that.getStatusBar();
    };

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
    };

    that.addMirror = function(host) {
        var l = mirrors.length;
        for (var i = 0; i < l; i++) {
            if (mirrors[i] === host) {
                return;
            }
        }
        mirrors.push(host);
    };

    fetchFileAndFinish();
};

module.exports = assetDownload;
