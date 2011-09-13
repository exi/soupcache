var fs = require('fs'),
    mime = require('mime'),
    api = function(options) {
        var that = this;

        that.sanitizeFileName = function(filename) {
            return encodeURIComponent(filename);
        };

        return {
            exists: function(filename) {
                var files = fs.readdirSync(options.cachePath);
                for (var file in files) {
                    if (that.sanitizeFileName(filename) == files[file]) {
                        return true;
                    }
                }
                return false;
            },
            insert: function(filename, buffer) {
                var loadingName = options.loadingCachePath + that.sanitizeFileName(filename),
                    cacheName = options.cachePath + that.sanitizeFileName(filename);
                fs.writeFileSync(loadingName, buffer, 0, buffer.length, 0, 'binary');
                fs.renameSync(loadingName, cacheName);
            },
            getFileMimeType: function(filename) {
                var cacheName = options.cachePath + that.sanitizeFileName(filename);
                return mime.lookup(cacheName);
            },
            getFileBuffer: function(filename) {
                var cacheName = options.cachePath + that.sanitizeFileName(filename);
                var stat = fs.statSync(cacheName);
                var fd = fs.openSync(cacheName, "r");
                var buffer = new Buffer(parseInt(stat.size));
                fs.readSync(fd, buffer, 0, buffer.length, 0);
                fs.close(fd);
                return buffer;
            }
        };
    };

module.exports = api;
