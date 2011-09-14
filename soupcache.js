var http = require('http'),
    url = require('url'),
    util = require('util'),
    server = null,
    onRequest = null,
    assetRequest = require('assetRequest.js'),
    htmlRequest = require('htmlRequest.js'),
    options = {
        domain: "soup.wthack.de:1234",
        port: 1234,
        cachePath: './cache/',
        loadingCachePath: './loading/',
        maxFileSize: 10485760
    };

var onRequest = function(request, response) {
    var assetRegex = new RegExp(".*\.asset\." + options.domain),
        assetRequestHandler = assetRequest(options),
        htmlRequestHandler = htmlRequest(options);

    if (request.headers.host && request.headers.host.match(assetRegex)) {
        new assetRequestHandler(request, response);
    } else {
        new htmlRequestHandler(request, response);
    }
};

server = http.createServer(onRequest).listen(options.port);
