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

    var onDownloadComplete = function(url, buffer) {
        downloadCount++;
        cacheHandler.insert(url, buffer);
        var mimeType = cacheHandler.getFileMimeType(url);

        for (var i in callbacks[url]) {
            callbacks[url][i](buffer, mimeType);
        }

        delete callbacks[url];
        delete activeDownloads[url];
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

    that.download = function(host, url, callback) {
        var buf = cacheHandler.getFileBuffer(url);
        if (buf === null) {
            _download(host, url, callback);
        } else {
            callback(buf);
        }
    };

    that.getStatus = function() {
        var status = "";
        status += "downloaded: " + downloadCount;
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
