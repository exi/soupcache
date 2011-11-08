var Url = require('url'),
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
    var statusCode = 200;
    var originalUrl = url;
    var redirects = 0;
    var maxRedirects = 10;

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

    var getUrl = function(href) {
        var newUrl = Url.parse(href);
        return newUrl.pathname + (newUrl.search || '');
    };

    var getHostname = function(href) {
        var newUrl = Url.parse(href);
        return newUrl.hostname;
    };

    var onFetchResponse = function(res) {
        if (res.statusCode == 302 &&
                redirects < maxRedirects &&
                originalUrl != getUrl(res.headers.location)) {
            var location = res.headers.location;
            url = getUrl(location);
            mirrors = [getHostname(location)];
            redirects++;
            options.stats.redirects++;

            fetchFileAndFinish();
        } else {
            res.setEncoding('binary');
            var contentLength = parseInt(res.headers['content-length']);
            fileSize = contentLength;
            fileBuffer = new Buffer(contentLength);
            statusCode = res.statusCode;
            res.on('error', onError);
            res.on('data', onFileData);
            res.on('end', onFileEnd);
        }
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
        callback(originalUrl, newbuf, statusCode);
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
