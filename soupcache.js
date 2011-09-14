var url = require('url'),
    http = require('http'),
    util = require('util'),
    server = null,
    onRequest = null,
    assetRequest = require('assetRequest.js'),
    htmlRequest = require('htmlRequest.js'),
    options = {
        domain: "soup.wthack.de",
        port: 1234,
        cachePath: './cache/',
        loadingCachePath: './cache/loading/',
        maxFileSize: 52428800, //50MB
        timeout: 5000 //5s
    };
http.globalAgent.maxSockets = 50;

// we need this because the browsers will expect port numbers
options.domain = options.domain + ":" + options.port;

var onRequest = function(request, response) {
    try {
        var assetRegex = new RegExp(".*\.asset\." + options.domain),
            assetRequestHandler = assetRequest(options),
            htmlRequestHandler = htmlRequest(options);

        console.log("" + new Date() + " " + request.connection.remoteAddress + ":");
        if (request.headers.host && request.headers.host.match(assetRegex)) {
            new assetRequestHandler(request, response);
        } else {
            new htmlRequestHandler(request, response);
        }
    } catch (e) {
        console.error("error:" + e.message);
    }
};

server = http.createServer(onRequest).listen(options.port);
