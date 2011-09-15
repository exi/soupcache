var url = require('url'),
    http = require('http'),
    cache = require('cache.js'),
    util = require('util');

var mod = function(options) {
        var cacheHandler = cache(options);
        return function(request, response) {
            var that = this;
            that.request = request;
            that.response = response;

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

            that.respondeWithFile = function(buffer, contentType) {
                that.response.writeHead(200, {
                    'Content-Type': contentType,
                    'Content-Length': buffer.length,
                    'Cache-Control': 'max-age=2592000' //30 days
                });
                options.stats.dataCount[that.request.connection.remoteAddress] += buffer.length;
                that.response.end(buffer, 'binary');
            };

            that.fetchFileAndResponde = function() {
                options.assetLoader.download(that.getAssetHost(), that.getAssetPath(), that.respondeWithFile);
            };

            that.fetchFileAndResponde();
        };
    };

module.exports = mod;
