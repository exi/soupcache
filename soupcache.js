var url = require('url'),
    http = require('http'),
    util = require('util'),
    server = null,
    onRequest = null,
    assetRequest = require('assetRequest.js'),
    htmlRequest = require('htmlRequest.js'),
    assetLoader = require('assetLoader.js'),
    statPrinter = require('statPrinter.js'),
    options = {
        domain: "soup.wthack.de",
        port: 1234,
        cachePath: './cache/',
        loadingCachePath: './cache/loading/',
        maxFileSize: 52428800, //50MB
        timeout: 5000 //5s
    };

options.assetLoader = new assetLoader(options);
options.stats = { dataCount:{}};
http.globalAgent.maxSockets = 50;

// we need this because the browsers will expect port numbers
options.domain = options.domain + ":" + options.port;


var onRequest = function(request, response) {
    var assetRegex = new RegExp(".*\.asset\." + options.domain),
        assetRequestHandler = assetRequest(options),
        htmlRequestHandler = htmlRequest(options);
    if (!options.stats.dataCount[request.connection.remoteAddress]) {
        options.stats.dataCount[request.connection.remoteAddress] = 0;
    }

    if (request.headers.host && request.headers.host.match(assetRegex)) {
        new assetRequestHandler(request, response);
    } else {
        new htmlRequestHandler(request, response);
    }
};

var statusProvider = [];

statusProvider.push(options.assetLoader.getStatus);

statusProvider.push(function() {
    var convertToHumanReadable = function(bytes) {
        var factors = [[1, 'B'], [1024, 'KB'], [1048576, 'MB'], [1073741824, 'GB']];
        var ret = "";
        for (var i = 0; i<factors.length; i++) {
            if (i+1 >= factors.length || (bytes>factors[i][0] && bytes<factors[i+1][0])) {
                ret = Math.floor(bytes/(factors[i][0])) + factors[i][1];
                break;
            }
        }
        return ret;
    };

    var status = "";
    if (Object.keys(options.stats.dataCount).length > 0) {
        var processed = 0;
        for (var i in options.stats.dataCount) {
            var lineend = Object.keys(options.stats.dataCount).length - 1 == processed?"":"\n";
            status += i + " " + convertToHumanReadable(options.stats.dataCount[i]) + lineend;
            processed++;
        }
    } else {
        status += "no clients yet";
    }

    return status;
});

statPrinter(statusProvider);

server = http.createServer(onRequest).listen(options.port);
