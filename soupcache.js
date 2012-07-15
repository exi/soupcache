var url = require('url'),
    http = require('http'),
    util = require('util'),
    server = null,
    onRequest = null,
    Cache = require('./mongocache.js'),
    assetRequest = require('./assetRequest.js'),
    nonAssetRequest = require('./nonAssetRequest.js'),
    loginRequest = require('./loginRequest.js'),
    statusRequest = require('./statusRequest.js'),
    parasoupRequest = require('./parasoupRequest.js'),
    assetLoader = require('./assetLoader.js'),
    statPrinter = require('./statPrinter.js'),
    events = new require('events'),
    options = {
        domainPrefix: "parasoup.de",
        ip: "188.40.102.160",
        port: 80,
        timeout: 30000, //30s
        mongodb: {
            host: '127.0.0.1',
            port: 27017
        }
    };

var startupComponents = function(options) {
    options.assetLoader = new assetLoader(options);
    options.stats = { dataCount: {}, redirects: 0, parasoups: 0, parasoupAssetCache: 0, assetCount: 0, requests: 0 };
    options.eventBus = new events.EventEmitter();

    // we need this because the browsers will expect port numbers
    //options.domain = options.domainPrefix + ":" + options.port;
    options.domain = options.domainPrefix;

    var parasoupRequestHandler = new parasoupRequest(options);

    var onRequest = function(request, response) {
        options.stats.requests++;

        var assetRegex = new RegExp(".*\\.asset\\." + options.domain),
            statusRegex = new RegExp("status\\." + options.domain),
            parasoupRegex = new RegExp("^" + options.domain + "$"),
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
        var start = new Date();
        return function() {
            var now = new Date();
            var diff = (now - start) / 1000 / 60;
            var s = 'redirects: ' + ( options.stats.redirects || 0 ) + '\n';
            var reqs = ( options.stats.requests || 0 );
            var rpm = Math.floor(( reqs / diff ) * 10) / 10;
            s += 'requests: ' + reqs + ' ' + rpm + '/min';
            return s;
        };
    } ());

    statusProvider.push(function() {
        var start = new Date();
        return function() {
            var maxLines = 10;
            var convertToHumanReadable = function(bytes) {
                var factors = [[1, 'B'], [1024, 'KB'], [1048576, 'MB'], [1073741824, 'GB']];
                var ret = "";
                for (var i = 0; i < factors.length; i++) {
                    if (i + 1 >= factors.length || (bytes > factors[i][0] && bytes < factors[i + 1][0]) || bytes === 0) {
                        ret = Math.floor(bytes / (factors[i][0])) + factors[i][1];
                        break;
                    }
                }
                return ret;
            };

            var sumBytes = 0;

            var dataArray = options.stats.dataCount;
            for (var i in options.stats.dataCount) {
                if (!(i === "" || typeof i == "undefined" || isNaN(dataArray[i]))) {
                    sumBytes += dataArray[i];
                }
            }

            var now = new Date();
            var diff = (now - start) / 1000 / 60;
            var sdiff = (now - start) / 1000;
            var served = ( options.stats.parasoups || 0 );
            var spm = Math.floor(( served / diff ) * 10) / 10;
            var bpm = Math.floor(( sumBytes / sdiff ) * 10) / 10;

            var status = "";

            status += "total data served: " + convertToHumanReadable(sumBytes) + " " + convertToHumanReadable(bpm) + "/s\n";
            status += "assets on server: " + options.stats.assetCount + "\n";
            status += "parasoups served: " + served + " " + spm + "/min\n";
            status += "parasoup asset cache: " + options.stats.parasoupAssetCache;

            return status;
        };
    } ());

    statusProvider.push(options.assetLoader.getStatus);


    options.statPrinter = new statPrinter(statusProvider);

    server = http.createServer(onRequest).listen(options.port, options.ip, function() {
        process.setuid('exi');
    });
};

new Cache(options, function(err, cacheHandler) {
    if (err) {
        throw err;
    } else {
        console.log("mongodb connected, starting http server...");
        options.cacheHandler = cacheHandler;
        startupComponents(options);
    }
});

