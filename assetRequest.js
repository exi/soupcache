var url = require('url'),
    http = require('http');

var mod = function(options) {
        return function(request, response) {
            var start = new Date();
            var that = this;

            that.getSubDomain = function() {
                var subDomainRegex = new RegExp("(.*)\\." + options.domain + ".*"),
                    results = null;
                results = request.headers.host.match(subDomainRegex);
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
                return request.url;
            };

            that.respondeWithFile = function(buffer, contentType, httpStatusCode) {
                try {
                    response.writeHead(httpStatusCode, {
                        'Content-Type': contentType,
                        'Content-Length': buffer.length,
                        'Cache-Control': 'max-age=2592000, public' //30 days
                    });
                    options.stats.dataCount[request.connection.remoteAddress] += buffer.length;
                    response.end(buffer, 'binary');
                    options.stats.responseTime += new Date() - start;
                    options.logger.access(request, httpStatusCode, buffer.length);
                } catch (e) {
                    // client missing or something
                    console.error("assetDownload", e);
                }
            };

            that.fetchFileAndResponde = function() {
                options.assetLoader.download(that.getAssetHost(), that.getAssetPath(), that.respondeWithFile);
            };

            that.fetchFileAndResponde();

        };
    };

module.exports = mod;
