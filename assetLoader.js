var url = require('url'),
    http = require('http'),
    AverageRing = require('./averageRing.js'),
    assetDownload = require('./assetDownload.js'),
    mime = require('./mimeTypeHelper.js');

var mod = function(options) {
    var cacheHandler = options.cacheHandler;
    var that = this;
    var activeDownloads = {};
    var callbacks = {};
    var downloadCount = 0;
    var downloadTimeRing = new AverageRing(500, false);

    that.download = function(host, url, callback) {
        cacheHandler.getFileBufferAndType(url, function(err, buffer, mimeType) {
            if (err) {
                _download(host, url, callback);
            } else {
                options.stats.assetsServed++;
                callback(buffer, mimeType, 200);
            }
        });
    };

    var _download = function(host, url, callback) {
        if (!activeDownloads[url]) {
            callbacks[url] = [callback];
            var start = new Date();
            activeDownloads[url] = new assetDownload(
                    host, url, options,
                    function() {
                        downloadTimeRing.add(new Date() - start);
                        onDownloadComplete.apply({}, arguments);
                    }
                );
        } else {
            callbacks[url].push(callback);
            activeDownloads[url].addMirror(host);
        }
    };

    var onDownloadComplete = function(url, buffer, httpStatusCode, mimeType) {
        var onMimeRequestResponse = function(err, mimeType) {
            for (var i in callbacks[url]) {
                callbacks[url][i](buffer, err ? 'text/html' : mimeType, httpStatusCode);
                options.stats.assetsServed++;
            }

            delete callbacks[url];
            delete activeDownloads[url];

            if (err) {
                options.logger.error("requesting mime type", err);
            }

            if (err ||
                    mimeType.search(/application/) != -1 ||
                    mimeType.search(/text/) != -1 ||
                    httpStatusCode < 200 ||
                    httpStatusCode >= 300) {
                options.stats.soupErrors++;
            } else {
                process.nextTick(function() {
                    cacheHandler.insertFileBuffer(url, buffer, mimeType, function(err) {
                        if (!err) {
                            options.eventBus.emit('newAsset', url, buffer, mimeType);
                            downloadCount++;
                        }
                    });
                });
            }
        }
        if (mimeType) {
            onMimeRequestResponse(null, mimeType)
        } else {
            mime.getBufferMimeType(buffer, onMimeRequestResponse);
        }
    };

    that.getStatus = function() {
        var servedCount = options.stats.assetsServed;
        var status = "";
        status += "assets served: " + servedCount + "\n";
        status += "downloaded: " + downloadCount + "\n";
        status += "cache efficiency: " + Math.round((servedCount / downloadCount) * 1000) / 1000 + "\n";
        status += "average soup download time: " + downloadTimeRing.getAverage(2) + "ms\n";
        if (Object.keys(activeDownloads).length > 0) {
            status += "\n";
            status += "active downloads:" + "\n";
            var processed = 0;
            for (var i in activeDownloads) {
                var lineend = Object.keys(activeDownloads).length - 1 == processed ? "" : "\n";
                status += callbacks[i].length + " clients: " + activeDownloads[i].getStatus() + lineend;
                processed++;
            }
        }

        return status;
    };
};

module.exports = mod;
