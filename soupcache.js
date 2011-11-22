var url = require('url'),
    http = require('http'),
    util = require('util'),
    server = null,
    onRequest = null,
    assetRequest = require('assetRequest.js'),
    nonAssetRequest = require('nonAssetRequest.js'),
    loginRequest = require('loginRequest.js'),
    statusRequest = require('statusRequest.js'),
    parasoupRequest = require('parasoupRequest.js'),
    assetLoader = require('assetLoader.js'),
    statPrinter = require('statPrinter.js'),
    events = new require('events'),
    options = {
        domainPrefix: "soup.wthack.de",
        port: 1234,
        cachePath: './psauxcache/',
        loadingCachePath: './psauxcache/loading/',
        maxFileSize: 52428800, //50MB
        timeout: 30000 //30s
    };

options.assetLoader = new assetLoader(options);
options.stats = { dataCount: {}, redirects: 0, parasoups: 0, parasoupAssetCache: 0 };
options.eventBus = new events.EventEmitter();
http.globalAgent.maxSockets = 50;

// we need this because the browsers will expect port numbers
options.domain = options.domainPrefix + ":" + options.port;

var parasoupRequestHandler = new parasoupRequest(options);

var onRequest = function(request, response) {
    var assetRegex = new RegExp(".*\.asset\." + options.domain),
        statusRegex = new RegExp("status\." + options.domain),
        parasoupRegex = new RegExp("parasoup\." + options.domain),
        assetRequestHandler = new assetRequest(options),
        nonAssetRequestHandler = new nonAssetRequest(options),
        loginRequestHandler = new loginRequest(options),
        statusRequestHandler = new statusRequest(options);

    if (!options.stats.dataCount[request.connection.remoteAddress]) {
        options.stats.dataCount[request.connection.remoteAddress] = 0;
    }

    if (request.headers.host && request.headers.host.match(statusRegex)) {
        new statusRequestHandler(request, response);
    } else if (request.headers.host && request.headers.host.match(parasoupRegex)) {
        new parasoupRequestHandler(request, response);
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
    var maxLines = 10;
    var convertToHumanReadable = function(bytes) {
        var factors = [[1, 'B'], [1024, 'KB'], [1048576, 'MB'], [1073741824, 'GB']];
        var ret = "";
        for (var i = 0; i<factors.length; i++) {
            if (i+1 >= factors.length || (bytes>factors[i][0] && bytes<factors[i+1][0]) || bytes == 0) {
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

    for (var i = 0; i < dataArray.length; i++) {
        if (dataArray[i] == "" || typeof dataArray[i] == "undefined" || isNaN(options.stats.dataCount[dataArray[i]])) {
            delete options.stats.dataCount[dataArray[i]];
            dataArray.splice(i, 1);
        }
    }

    var byteSort = function(a, b) {
        return parseInt(options.stats.dataCount[b]) - parseInt(options.stats.dataCount[a]);
    }

    var anonymizeIP = function(ip) {
        var lastDot = ip.lastIndexOf(".");
        return ip.substr(0, lastDot) + "\.*";
    }

    dataArray.sort(byteSort);

    var status = "";

    status += "parasoups served: " + options.stats.parasoups + "\n";
    status += "parasoup asset cache: " + options.stats.parasoupAssetCache + "\n";
    status += dataArray.length + " clients seen\n";
    status += "Top " + maxLines + " users:\n";

    if (dataArray.length > 0) {
        for (var i = 0; i < Math.min(dataArray.length, maxLines); i++) {
            var lineend = i == maxLines - 1?"":"\n";
            status += anonymizeIP(dataArray[i]) +
                      " " +
                      convertToHumanReadable(options.stats.dataCount[dataArray[i]]) + lineend;
        }
    } else {
        status += "no clients yet";
    }

    return status;
});

options.statPrinter = new statPrinter(statusProvider);

server = http.createServer(onRequest).listen(options.port);
