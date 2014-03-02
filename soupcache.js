var url = require('url'),
    AuthCheck = require('./authCheck.js'),
    http = require('http'),
    fs = require('fs'),
    async = require('async'),
    util = require('util'),
    AverageRing = require('./averageRing.js'),
    server = null,
    onRequest = null,
    Cache = require('./mongocache.js'),
    Logger = require('./logger.js'),
    assetRequest = require('./assetRequest.js'),
    nonAssetRequest = require('./nonAssetRequest.js'),
    loginRequest = require('./loginRequest.js'),
    statusRequest = require('./statusRequest.js'),
    parasoupRequest = require('./parasoupRequest.js'),
    maintenanceRequest = require('./maintenanceRequest.js'),
    assetLoader = require('./assetLoader.js'),
    statPrinter = require('./statPrinter.js'),
    events = new require('events'),
    options = JSON.parse(fs.readFileSync('./config.json'));

function requestDispatcher(request, response) {
    if (onRequest) {
        onRequest(request, response);
    } else {
        response.writeHead(503);
        response.end('Parasoup starting up');
    }
}

function startupComponents(options) {
    options.assetLoader = new assetLoader(options);
    options.stats = {
        dataCount: {},
        redirects: 0,
        parasoups: 0,
        parasoupAssetCache: 0,
        assetCount: 0,
        requests: 0,
        soupErrors: 0,
        assetsServed: 0,
        responseTime: 0,
        cacheHits: 0
    };
    options.eventBus = new events.EventEmitter();

    options.domain = options.domainPrefix;

    var parasoupRequestHandler = new parasoupRequest(options);
    var authCheck = new AuthCheck(options);

    onRequest = function(request, response) {
        options.stats.requests++;

        var assetRegex = new RegExp('asset-.\\.' + options.domain),
            statusRegex = new RegExp('status\\.' + options.domain),
            parasoupRegex = new RegExp('^' + options.domain + '$'),
            assetRequestHandler = new assetRequest(options),
            nonAssetRequestHandler = new nonAssetRequest(options),
            loginRequestHandler = new loginRequest(options),
            statusRequestHandler = new statusRequest(options);
            maintenanceRequestHandler = new maintenanceRequest(options);

        if (!options.stats.dataCount[request.connection.remoteAddress]) {
            options.stats.dataCount[request.connection.remoteAddress] = 0;
        }

        var maint = fs.existsSync(options.maintenanceTriggerFile);
        if (maint) {
            new maintenanceRequestHandler(request, response);
        } else {
            if (request.headers.host && request.headers.host.match(assetRegex) && request.url.indexOf('?') === -1) {
                new assetRequestHandler(request, response);
            } else {
                if (!authCheck.checkAuth(request, response)) {
                    return;
                }
                if (request.headers.host && request.headers.host.match(statusRegex)) {
                    new statusRequestHandler(request, response);
                } else if (request.headers.host && request.headers.host.match(parasoupRegex)) {
                    new parasoupRequestHandler(request, response);
                } else {
                    new nonAssetRequestHandler(request, response);
                }
            }
        }
    };

    var statusProvider = [];

    statusProvider.push(function() {
        var start = new Date();
        var requestRing = new AverageRing(120 * options.statsPerSecond);
        return function() {
            var s = 'redirects: ' + ( options.stats.redirects || 0 ) + '\n';
            var reqs = ( options.stats.requests || 0 );
            requestRing.add(reqs);
            var rpm = requestRing.getAveragePerTime(2, 1000);
            s += 'requests: ' + reqs + ' ' + rpm + '/s';
            return s;
        };
    } ());

    statusProvider.push(function() {
        var start = new Date();
        var parasoupRing = new AverageRing(120 * options.statsPerSecond);
        var byteSumRing = new AverageRing(120 * options.statsPerSecond);
        var cacheHitRing = new AverageRing(120 * options.statsPerSecond);
        var responseTimeRing = new AverageRing(120 * options.statsPerSecond);
        return function() {
            var maxLines = 10;
            var convertToHumanReadable = function(bytes) {
                var factors = [[1, 'B'], [1024, 'KB'], [1048576, 'MB'], [1073741824, 'GB']];
                var ret = '';
                for (var i = 0; i < factors.length; i++) {
                    if (i + 1 >= factors.length || (bytes > factors[i][0] && bytes < factors[i + 1][0]) || bytes === 0) {
                        ret = Math.floor((bytes / (factors[i][0])) * 100 ) / 100 + factors[i][1];
                        break;
                    }
                }
                return ret;
            };

            var sumBytes = 0;

            var dataArray = options.stats.dataCount;
            for (var i in options.stats.dataCount) {
                if (!(i === '' || typeof i == 'undefined' || isNaN(dataArray[i]))) {
                    sumBytes += dataArray[i];
                }
            }

            var served = options.stats.parasoups;
            parasoupRing.add(served);
            byteSumRing.add(sumBytes);
            cacheHitRing.add(options.stats.cacheHits);
            responseTimeRing.add(options.stats.responseTime);
            var sps = parasoupRing.getAveragePerTime(2, 1000);
            var bps = byteSumRing.getAveragePerTime(2, 1000);
            var chps = cacheHitRing.getAveragePerTime(2, 1000);
            var art = responseTimeRing.getAveragePerTime(2, 1000);
            var chr = (100 / options.stats.assetsServed) * options.stats.cacheHits;
            var cacheHitRatio = Math.floor(chr * 100) / 100 ;

            var status = '';

            status += 'total data served: ' + convertToHumanReadable(sumBytes) + ' ' + convertToHumanReadable(bps) + '/s\n';
            status += 'assets on server: ' + options.stats.assetCount + '\n';
            status += 'parasoups served: ' + served + ' ' + sps + '/s\n';
            status += 'parasoup asset cache: ' + options.stats.parasoupAssetCache + '\n';
            status += 'memory cache hits: ' + options.stats.cacheHits + ' ' + chps + '/s ' + cacheHitRatio + '%\n';
            status += 'soup server errors: ' + options.stats.soupErrors + '\n';
            status += 'average response time: ' + art + 'ms';

            return status;
        };
    } ());

    statusProvider.push(function() {
        return 'active logins: ' + authCheck.getActiveLoginCount();
    });

    statusProvider.push(options.assetLoader.getStatus);

    statusProvider.push(function() {
        if (fs.existsSync('./externalMessage')) {
            return fs.readFileSync('./externalMessage');
        } else {
            return '';
        }
    });

    options.statPrinter = new statPrinter(statusProvider, options.statsPerSecond);
    options.logger.info("startup done");
    options.logger.console("startup done");
};

server = http.createServer(requestDispatcher).listen(options.port, options.ip, function() {
    process.setuid(options.uid);

    async.series({
        logger: function(cb) {
            options.logger = new Logger(options, function(err) {
                console.log('logger ready');
                cb(err);
            });
        },
        cacheHandler: function(cb) {
            new Cache(options, function(err, cacheHandler) {
                if (err) {
                    return cb(err);
                } else {
                    console.log('cachehandler ready');
                    options.logger.console('mongodb connected');
                    options.cacheHandler = cacheHandler;
                    cb(null);
                }
            });
        }
    }, function(err) {
        if (err) {
            throw err;
        } else {
            options.logger.info("startup");
            options.logger.console("startup");
            startupComponents(options);
        }
    });
});
