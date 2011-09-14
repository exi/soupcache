var url = require('url'),
    http = require('http'),
    cache = require('cache.js'),
    util = require('util'),
    mod = function(options) {
        var cacheHandler = cache(options);
        return function(request, response) {
            var that = this;
            that.fileBuffer = null;
            that.fileWritten = 0;
            that.request = request;
            that.response = response;

            that.getFileName = function() {
                return that.request.url;
            };

            that.getSubDomain = function() {
                var subDomainRegex = new RegExp("(.*)\." + options.domain + ".*"),
                    results = null;
                results = that.request.headers.host.match(subDomainRegex);
                if (results && results[1]) {
                    return results[1];
                } else {
                    return null;
                }
            };


            that.getAssetHost = function() {
                return that.getSubDomain() + ".soup.io";
            };

            that.getAssetPath = function() {
                return that.request.url;
            };

            that.respondeWithFile = function() {
                //console.log("serve file " + that.getFileName());
                var fileBuffer = cacheHandler.getFileBuffer(that.getFileName());
                that.response.writeHead(200, {
                    'Content-Type': cacheHandler.getFileMimeType(that.getFileName()),
                    'Content-Length': fileBuffer.length,
                    'Cache-Control': 'max-age=2592000' //30 days
                });
                that.response.end(fileBuffer, 'binary');
            };

            that.onFileData = function(chunk) {
                that.fileBuffer.write(chunk, that.fileWritten, 'binary');
                that.fileWritten += Buffer.byteLength(chunk, 'binary');
            }

            that.onFileEndSaveAndResponde = function() {
                console.log("writing file " + that.getFileName() + " with size: " + that.fileWritten);
                cacheHandler.insert(that.getFileName(), that.fileBuffer.slice(0, that.fileWritten));
                that.respondeWithFile();
            }

            that.fetchResponse = function(res) {
                res.setEncoding('binary');
                that.fileBuffer = new Buffer(parseInt(res.headers['content-length']));
                res.on('data', that.onFileData);
                res.on('end', that.onFileEndSaveAndResponde);

            }

            that.fetchFileAndResponde = function() {
                http.get({
                    host: that.getAssetHost(),
                    port: 80,
                    path: that.getAssetPath()
                },
                that.fetchResponse);
            };

            try {
                if (cacheHandler.exists(that.getFileName())) {
                    that.respondeWithFile();
                } else {
                    that.fetchFileAndResponde();
                }
            } catch (e) {
                console.error("error:" + e.message);
                that.response.end();
            }
        };
    };

module.exports = mod;
