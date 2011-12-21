var fs = require('fs'),
    mime = require('mime-magic'),
    crypto = require('crypto');
    cacheCreated = {},
    api = function(options) {
        var createCacheDir = function() {
            _createCacheDir(options.cachePath);
            _createCacheDir(options.loadingCachePath);
        }

        var _createCacheDir = function(dir) {
            if (!cacheCreated[dir]) {
                console.log("generating cache dir " + dir);
                for (var i = 0; i<16; i++) {
                    for (var e = 0; e<16; e++) {
                        try  {
                            fs.mkdirSync(dir + i.toString(16) + e.toString(16), 0755);
                        } catch (e) {
                            if (e.code != "EEXIST") {
                                throw e;
                            }
                        }
                    }
                }

                cacheCreated[dir] = true;
            }
        }

        var sanitizeFileName = function(filename) {
            var hash = crypto.createHash("SHA1");
            hash.update(filename);
            var filenameHash = hash.digest("hex");
            var hashCut = filenameHash.substr(0, 2);
            return hashCut + "/" + encodeURIComponent(filename);
        };

        var _getFileMimeType = function(cacheName, callback, tries) {
            try {
                mime.fileWrapper(cacheName, function(err, type) {
                    if (err) {
                        // assume text/html
                        callback('text/html');
                    } else {
                        callback(type);
                    }
                });
            } catch (e) {
                if (tries < 5) {
                    _getFileMimeType(cacheName, callback, tries + 1);
                }
            }
        };

        createCacheDir();

        return {
            exists: function(filename) {
                var files = fs.readdirSync(options.cachePath);
                for (var file in files) {
                    if (sanitizeFileName(filename) == files[file]) {
                        return true;
                    }
                }
                return false;
            },
            insert: function(filename, buffer) {
                var loadingName = options.loadingCachePath + sanitizeFileName(filename),
                    cacheName = options.cachePath + sanitizeFileName(filename);

                fs.writeFileSync(loadingName, buffer, 0, buffer.length, 0, 'binary');
                fs.renameSync(loadingName, cacheName);
            },
            remove: function(filename) {
                var cacheName = options.cachePath + sanitizeFileName(filename);
                try {
                    fs.unlink(cacheName);
                } catch (e) {
                    //file not found
                    console.error(e);
                }
            },
            getFileMimeType: function(filename, callback) {
                var cacheName = options.cachePath + sanitizeFileName(filename);
                _getFileMimeType(cacheName, callback, 0);
            },
            getFileBuffer: function(filename) {
                var cacheName = options.cachePath + sanitizeFileName(filename);
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
