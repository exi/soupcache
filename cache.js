var fs = require('fs'),
    mime = require('mime-magic'),
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
            remove: function(filename) {
                var cacheName = options.cachePath + that.sanitizeFileName(filename);
                try {
                    fs.unlink(cacheName);
                } catch (e) {
                    //file not found
                    console.error(e);
                }
            },
            getFileMimeType: function(filename, callback) {
                var cacheName = options.cachePath + that.sanitizeFileName(filename);
                mime.fileWrapper(cacheName, function(err, type) {
                    if (err) {
                        // assume text/html
                        callback('text/html');
                    } else {
                        callback(type);
                    }
                });
            },
            getFileBuffer: function(filename) {
                var cacheName = options.cachePath + that.sanitizeFileName(filename);
                var buffer = null;
                try {
                    buffer = fs.readFileSync(cacheName);
                } catch (e) {
                    //file not found
                }
                return buffer;
            }
        };
    };

module.exports = api;
