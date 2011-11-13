var url = require('url'),
    http = require('http'),
    util = require('util'),
    server = null,
    onRequest = null,
    assetRequest = require('assetRequest.js'),
    nonAssetRequest = require('nonAssetRequest.js'),
    loginRequest = require('loginRequest.js'),
    assetLoader = require('assetLoader.js'),
    statPrinter = require('statPrinter.js'),
    options = {
        domain: "soup.wthack.de",
        port: 1234,
        cachePath: './psauxcache/',
        loadingCachePath: './psauxcache/loading/',
        maxFileSize: 52428800, //50MB
        timeout: 30000 //30s
    };

options.assetLoader = new assetLoader(options);
options.stats = { dataCount: {}, redirects: 0 };
http.globalAgent.maxSockets = 50;

// we need this because the browsers will expect port numbers
options.domain = options.domain + ":" + options.port;


var onRequest = function(request, response) {
    var assetRegex = new RegExp(".*\.asset\." + options.domain),
        loginRegex = new RegExp("\/login"),
        assetRequestHandler = new assetRequest(options),
        nonAssetRequestHandler = new nonAssetRequest(options);
        loginRequestHandler = new loginRequest(options);
    if (!options.stats.dataCount[request.connection.remoteAddress]) {
        options.stats.dataCount[request.connection.remoteAddress] = 0;
    }

    if (request.url && request.url.match(loginRegex)) {
        new loginRequestHandler(request, response);
    } else if (request.headers.host && request.headers.host.match(assetRegex)) {
        new assetRequestHandler(request, response);
    } else {
        new nonAssetRequestHandler(request, response);
    }
};

var statusProvider = [];

statusProvider.push(function() {
    return 'redirects: ' + options.stats.redirects || 0;
});

statusProvider.push(options.assetLoader.getStatus);

statusProvider.push(function() {
    var maxLines = 8;
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

    var dataArray = [];

    for (var i in options.stats.dataCount) {
        dataArray.push(i);
    }

    var byteSort = function(a, b) {
        return options.stats.dataCount[b] - options.stats.dataCount[a];
    }

    dataArray.sort(byteSort);

    var status = "";
    if (dataArray.length > 0) {
        for (var i = 0; i < Math.min(dataArray.length, maxLines); i++) {
            var lineend = i == maxLines - 1?"":"\n";
            status += dataArray[i] + " " + convertToHumanReadable(options.stats.dataCount[dataArray[i]]) + lineend;
        }
    } else {
        status += "no clients yet";
    }

    return status;
});

statPrinter(statusProvider);

server = http.createServer(onRequest).listen(options.port);
