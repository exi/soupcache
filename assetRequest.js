var url = require('url'),
    http = require('http'),
    cache = require('cache.js'),
    util = require('util');

var mod = function(options) {
        var cacheHandler = cache(options);
        return function(request, response) {
            var that = this;

            that.getSubDomain = function() {
                var subDomainRegex = new RegExp("(.*)\." + options.domain + ".*"),
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
                        'Cache-Control': 'max-age=2592000' //30 days
                    });
                    options.stats.dataCount[request.connection.remoteAddress] += buffer.length;
                    response.end(buffer, 'binary');
                } catch (e) {
                    // client missing or something
                }
            };

            that.fetchFileAndResponde = function() {
                options.assetLoader.download(that.getAssetHost(), that.getAssetPath(), that.respondeWithFile);
            };

            that.fetchFileAndResponde();

        };
    };

module.exports = mod;
