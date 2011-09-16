var url = require('url'),
    http = require('http'),
    cache = require('cache.js'),
    assetDownload = require('assetDownload.js'),
    util = require('util');

var mod = function(options) {
    var cacheHandler = cache(options);
    var that = this;
    that.activeDownloads = {};
    that.callbacks = {};
    that.downloadCount = 0;

    that.onDownloadComplete = function(url, buffer) {
        that.downloadCount++;
        cacheHandler.insert(url, buffer);
        var mimeType = cacheHandler.getFileMimeType(url);

        for (var i in that.callbacks[url]) {
            that.callbacks[url][i](buffer, mimeType);
        }

        delete that.callbacks[url];
        delete that.activeDownloads[url];
    };

    that._download = function(host, url, callback) {
        if (!that.activeDownloads[url]) {
            that.callbacks[url] = [callback];
            that.activeDownloads[url] = new assetDownload(host, url, options,  that.onDownloadComplete);
        } else {
            that.callbacks[url].push(callback);
            that.activeDownloads[url].addMirror(host);
        }
    };

    that.download = function(host, url, callback) {
        var buf = cacheHandler.getFileBuffer(url);
        if (buf === null) {
            that._download(host, url, callback);
        } else {
            callback(buf);
        }
    };

    that.getStatus = function() {
        var status = "";
        status += "downloaded: " + that.downloadCount;
        if (Object.keys(that.activeDownloads).length > 0) {
            status += "\n";
            status += "active downloads:" + "\n";
            var processed = 0;
            for (var i in that.activeDownloads) {
                var lineend = Object.keys(that.activeDownloads).length - 1 == processed?"":"\n";
                status += that.callbacks[i].length + " clients: " + that.activeDownloads[i].getStatus() + lineend;
                processed++;
            }
        }

        return status;
    }
};

module.exports = mod;
