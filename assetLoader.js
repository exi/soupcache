var url = require('url'),
    http = require('http'),
    cache = require('cache.js'),
    assetDownload = require('assetDownload.js'),
    util = require('util');

var mod = function(options) {
    var cacheHandler = cache(options);
    var that = this;
    var activeDownloads = {};
    var callbacks = {};
    var downloadCount = 0;
    var notCached = 0;
    var servedCount = 0;

    that.download = function(host, url, callback) {
        var buf = cacheHandler.getFileBuffer(url);
        if (buf === null) {
            _download(host, url, callback);
        } else {
            cacheHandler.getFileMimeType(url, function(mimeType) {
                callback(buf, mimeType, 200);
                servedCount++;
            });
        }
    };

    var _download = function(host, url, callback) {
        if (!activeDownloads[url]) {
            callbacks[url] = [callback];
            activeDownloads[url] = new assetDownload(host, url, options,  onDownloadComplete);
        } else {
            callbacks[url].push(callback);
            activeDownloads[url].addMirror(host);
        }
    };

    var onDownloadComplete = function(url, buffer, httpStatusCode) {
        downloadCount++;
        servedCount++;
        cacheHandler.insert(url, buffer);
        cacheHandler.getFileMimeType(url, function(mimeType) {
            for (var i in callbacks[url]) {
                callbacks[url][i](buffer, mimeType, httpStatusCode);
            }

            delete callbacks[url];
            delete activeDownloads[url];

            if (mimeType.search(/text/) != -1 || httpStatusCode < 200 || httpStatusCode >= 300) {
                // we don't want to cache text files but the mimetype library does not support buffers so we put it on disk,
                // lookup the mimetype and remove it again...
                cacheHandler.remove(url);
                notCached++;
            }
        });

    };

    that.getStatus = function() {
        var status = "";
        status += "assets served: " + servedCount + "\n";
        status += "downloaded: " + downloadCount + "\n";
        status += "not cached: " + notCached;
        if (Object.keys(activeDownloads).length > 0) {
            status += "\n";
            status += "active downloads:" + "\n";
            var processed = 0;
            for (var i in activeDownloads) {
                var lineend = Object.keys(activeDownloads).length - 1 == processed?"":"\n";
                status += callbacks[i].length + " clients: " + activeDownloads[i].getStatus() + lineend;
                processed++;
            }
        }

        return status;
    }
};

module.exports = mod;
