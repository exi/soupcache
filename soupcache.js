var http = require('http'),
    url = require('url'),
    util = require('util'),
    server = null,
    onRequest = null,
    assetRequest = require('assetRequest.js'),
    htmlRequest = require('htmlRequest.js'),
    options = {
        domain: "stest.io:1234",
        port: 1234
    };

onRequest = function(request, response) {
    var assetRegex = /.*asset\.soup\.io\/.*/,
        params = url.parse(request.url),
        assetRequestHandler = assetRequest(options),
        htmlRequestHandler = htmlRequest(options);

    console.log("new request:" + util.inspect(params));
    if (params.host && params.host.match(assetRegex)) {
        assetRequestHandler(request, response);
    } else {
        htmlRequestHandler(request, response);
    }
};

server = http.createServer(onRequest).listen(options.port);
