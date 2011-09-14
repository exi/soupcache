var url = require('url'),
    http = require('http'),
    cache = require('cache.js'),
    util = require('util');

var mod = function(options) {
        var cacheHandler = cache(options);
        return function(request, response) {
            var that = this;
            that.fileBuffer = null;
            that.fileWritten = 0;
            that.request = request;
            that.response = response;
            that.fileSize = 0;

            that.printRequest = function() {
                console.log(that.request.method+" "+that.getAssetHost()+that.request.url);
            }

            that.getStatusBar = function() {
                var bar = "[";
                if (that.fileSize > 0) {
                    for (var pos = 0; pos < 20; pos++) {
                        if ((that.fileWritten / that.fileSize) * 20 >= pos) {
                            bar += "#";
                        } else {
                            bar += " ";
                        }
                    }
                }
                bar += "]";
                return bar;
            }

            that.printProgess = function() {
                console.log("download "+that.getAssetHost()+that.request.url + " " + that.fileWritten +
                        "/" + that.fileSize + " " + that.getStatusBar());
            }

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
                console.log("serve file " + that.getFileName());
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
                that.printProgess();
            }

            that.onFileEndSaveAndResponde = function() {
                console.log("store file " + that.getFileName() + " with size: " + that.fileWritten);
                cacheHandler.insert(that.getFileName(), that.fileBuffer.slice(0, that.fileWritten));
                that.respondeWithFile();
            }

            that.onRequestTimeout = function() {
                console.log("timeout...retry");
                that.fetchFileAndResponde();
            }
            that.onError = function(error) {
                console.trace();
                that.printRequest();
                console.log("error: " + error.message);
                console.log("retry");
                that.fetchFileAndResponde();
            };


            that.fetchResponse = function(res) {
                res.setEncoding('binary');
                var contentLength = parseInt(res.headers['content-length']);
                that.fileSize = contentLength;
                that.fileBuffer = new Buffer(contentLength);
                res.on('error', that.onError);
                res.on('data', that.onFileData);
                res.on('end', that.onFileEndSaveAndResponde);

            }

            that.fetchFileAndResponde = function() {
                that.printRequest();
                try {
                    that.soupRequest = http.get({
                            host: that.getAssetHost(),
                            port: 80,
                            path: that.getAssetPath()
                        },
                        that.fetchResponse);
                    that.soupRequest.on('error', that.onError);
                    that.soupRequest.setTimeout(options.timeout, that.onRequestTimeout);
                } catch (e) {
                    console.log("error:" + e.messsage);
                    that.response.end();
                }
            };

            try {
                if (cacheHandler.exists(that.getFileName())) {
                    that.respondeWithFile();
                } else {
                    that.fetchFileAndResponde();
                }
            } catch (e) {
                console.error("error:" + e.message);
            }
        };
    };

module.exports = mod;
