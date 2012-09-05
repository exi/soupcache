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
    var mimeType = null;
    var startDate = new Date();
    var soupRequest = null;
    var statusCode = 200;
    var originalUrl = url;
    var redirects = 0;
    var maxRedirects = 15;
    var maxDownloadTime = 1000 * 60 * 60 * 24; // 24 hours
    var abortTimer = null;
    var abortTimerTime = null;

    var resetValues = function() {
        fileSize = 0;
        fileWritten = 0;
        fileBuffer = null;
        soupRequest = null;
        mimeType = null;
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
        setAbortTimer();
    };

    var getMirror = function() {
        return mirrors[tries % mirrors.length];
    };

    var setAbortTimer = function() {
        if (!abortTimer) {
            abortTimer = setTimeout(
                function() {
                    options.logger.error("aborting asset download");
                    errorFinish(500);
                },
                maxDownloadTime
            );
            abortTimerTime = new Date((new Date()).getTime() + maxDownloadTime);
        }
    };

    var clearAbortTimer = function() {
        if (abortTimer !== null) {
            clearTimeout(abortTimer);
            abortTimer = null;
            abortTimerTime = null;
        }
    };

    var getUrl = function(href) {
        var newUrl = Url.parse(Url.resolve(url, href));
        return newUrl.pathname + (newUrl.search || '');
    };

    var getHostname = function(href) {
        var newUrl = Url.parse(href);
        return newUrl.hostname;
    };

    var onFetchResponse = function(res) {
        if (res.statusCode >= 300 && res.statusCode < 400) {
            url = getUrl(res.headers.location);
            if (originalUrl == url) {
                options.logger.error("endless redirect detected...");
                errorFinish(404);
            } else if (!hasSaneConditions()) {
                errorFinish(404);
            } else if (redirects < maxRedirects) {
                var newHost = getHostname(url);

                if (newHost) {
                    mirrors = [newHost];
                }

                options.stats.redirects++;
                redirects++;
                fetchFileAndFinish();
            } else {
                options.logger.error("aborting asset request because of too many redirects");
                errorFinish(404);
            }
        } else if (res.statusCode >= 500) {
            options.stats.soupErrors++;
            soupRequest.abort();
            retry();
        } else {
            res.setEncoding('binary');
            var contentLength = parseInt(res.headers['content-length']);
            fileSize = contentLength;
            mimeType = res.headers['content-type'] ? res.headers['content-type'] : null;
            statusCode = res.statusCode;
            res.on('error', onError);
            res.on('data', onFileData);
            res.on('end', onFileEnd);
        }
    };

    var onRequestTimeout = function() {
        options.logger.log("assedDownload timeout...retry");
        retry();
    };

    var onError = function(error) {
        retry();
    };

    var retry = function() {
        function baseDistribution(x) {
            return Math.sin(x / 2) * (1 - x);
        }
        function distributionDistortion(x) {
            return (1/(1+Math.exp(-(x*2-1)*2)));
        }
        tries++;
        var now = new Date();
        var x = now.getTime() - startDate.getTime();
        var xdm = x / maxDownloadTime;
        var waitTime = Math.max(
            Math.floor(baseDistribution(xdm) * distributionDistortion(xdm) * (maxDownloadTime - x)),
            1000
        );
        options.logger.error("asset retry(" + tries + ") '" + url +"' next in " + waitTime + "ms");
        if (x + waitTime < maxDownloadTime) {
            setTimeout(fetchFileAndFinish, waitTime);
        } else {
            errorFinish(500);
        }
    }

    var onFileData = function(chunk) {
        if (fileBuffer === null) {
            fileBuffer = new Buffer(fileSize);
        }

        try {
            fileBuffer.write(chunk, fileWritten, 'binary');
            fileWritten += Buffer.byteLength(chunk, 'binary');
        } catch (e) {
            var msg = "fileWritten: " + fileWritten + "\n" +
                        "fileSize: " + fileSize + "\n" +
                        "bufferlength: " + fileBuffer.length;
            options.logger.error(msg, e);
            errorFinish(500, e);
        }
    };

    var onFileEnd = function() {
        finish();
    };

    var finish = function() {
        clearAbortTimer();
        if (fileBuffer === null && (statusCode < 200 || statusCode >= 300)) {
            options.logger.error("file Buffer empty" + originalUrl);
            retry();
        } else if (fileWritten !== fileSize) {
            options.logger.error("incomplete data " + originalUrl);
            retry();
        } else {
            try {
                if (fileBuffer === null) {
                    //this happens if soup responds with an empty file and 200 status code, which is ok i guess
                    fileBuffer = "";
                }
                var newbuf = new Buffer(fileBuffer).slice(0, fileWritten);
                callback(originalUrl, newbuf, statusCode, mimeType);
            } catch (e) {
                options.logger.error("assetDownloadFinish", e);
                retry();
            }
        }
    };

    var errorFinish = function(status, error) {
        status = status || 500;
        if (soupRequest) {
            try {
                soupRequest.abort();
            } catch (err) {
                options.logger.error("assed errorFinish", err);
            }
        }
        options.logger.error("errorFinish(" + status + ") " + originalUrl, error);
        var newbuf = new Buffer(0);
        callback(originalUrl, newbuf, status);
    };

    that.getStatus = function() {
        var waitingTime = ((new Date()).getTime() - startDate.getTime()) / 1000;
        waitingTime = Math.floor(waitingTime / 10) * 10;
        var mirrorsString = "[" + mirrors.join(",") + "]";
        return "http://" + currentMirror + url + " \t" + (tries + 1) + " tries \t" +
            waitingTime + "/" + (maxDownloadTime / 1000) + "s \t" + fileWritten + "/" + fileSize + " \t mirrors:" + mirrorsString + "\t" + that.getStatusBar();
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

    var hasSaneConditions = function() {
        if (!mirror) {
            return false;
        }

        var reg = /\.\./;
        if (reg.test(url) || reg.test(mirror)) {
            return false;
        }

        return true;
    };

    if (hasSaneConditions()) {
        fetchFileAndFinish();
    } else {
        errorFinish(404);
    }
};

module.exports = assetDownload;
