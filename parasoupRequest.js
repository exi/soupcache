var fs = require('fs'),
    Cache = require('./parasoupCache.js');
var soupInterval = 950;
var mod = function(options) {
    var clients = [],
        cache = null,
        cacheSize = null,
        cacheHandler = options.cacheHandler,
        getHtmlContent = function() {
            return fs.readFileSync('./parasoup.html', 'utf-8');
        },
        getNewHtmlContent = function() {
            return fs.readFileSync('./parasoupNew.html', 'utf-8');
        },
        served = 0,
        cacheLoaded = false,
        madcounter = 0,
        stallTimer = null;

    options.eventBus.on('newAsset', function(url, buffer, contentType) {
        if (buffer.length > 30 * 1024) {
            if (clients.length > 0) {
                deliverToClients(url);
            } else if (cache !== null) {
                cache.insert(url, function(err) {
                    if (err) {
                        options.logger.error('cacheInsert ' + url, err);
                    } else {
                        cacheSize++;
                        updateStats();
                    }
                });
            }
            resetStallTimer();
        }
    });

    var deliverToClients = function(url) {
        var response = 'http://a.asset.' + options.domain + url;
        var addresses = [];
        cacheHandler.prefetchFile(url);
        for (var i = 0; i < clients.length; i++) {
            try {
                clients[i].response.writeHead(
                    200,
                    {
                        'Content-Length': response.length,
                        'Content-Type': 'text/plain',
                        'Cache-Control': 'no-cache'
                    }
                );
                clients[i].response.end(response);
                addresses.push(clients[i].request.connection.remoteAddress);
                served++;
                options.logger.access(clients[i].request, 200, response.length);
            } catch (e) {
                options.logger.error('parasoupRequest', e);
            }
        }
        options.logger.info(url + ' to ' + addresses.join(', '));
        updateStats();
        clients = [];
    };

    var getCacheSize = function(cb) {
        cache.size(function(err, size) {
            if (err) {
                cb(err);
            } else {
                cacheSize = size;
                updateStats();
                cb(null, size);
            }
        });
    };

    var deliverDataIfNecessary = function(cb) {
        if (clients.length === 0) {
            return cb();
        } else {
            getCacheSize(function(err, size) {
                if (err) {
                    options.logger.error('getCacheSize', err)
                } else if (size > 0) {
                    cache.getAndRemoveItem(function(err, url) {
                        if (err) {
                            options.logger.error('getAndRemoveItem', err)
                            return cb(null);
                        } else {
                            deliverToClients(url);
                            return cb(null);
                        }
                    });
                } else {
                    return cb(null);
                }
            });
        }
    };

    var onStallTimer = function() {
        removeStallTimer();
        deliverDataIfNecessary(function() {
            resetStallTimer();
        });
    };

    var removeStallTimer = function() {
        if (stallTimer !== null) {
            clearTimeout(stallTimer);
            stallTimer = null;
        }
    };

    var resetStallTimer = function() {
        removeStallTimer();
        stallTimer = setTimeout(onStallTimer, soupInterval);
    };

    var updateStats = function() {
        options.stats.parasoupAssetCache = cacheSize;
        options.stats.parasoups = served;
    };

    Cache(options, function(err, tcache) {
        cache = tcache;
        getCacheSize(function() {});
        resetStallTimer();
    });

    return function(request, response) {
        if (request.url == '/newStuff?') {
            clients.push({
                request: request,
                response: response
            });
        } else if (request.url == '/newHTML') {
            var html = getNewHtmlContent();
            response.writeHead(200, {
                'Content-Length': html.length,
                'Content-Type': 'text/html'
            });
            response.end(html);
        } else if (request.url == '/robots.txt') {
            var robots = 'User-agent: *\nDisallow:\n';
            response.writeHead(200, {
                'Content-Length': robots.length,
                'Content-Type': 'text/plain'
            });
            response.end(robots);
        } else {
            var html = getHtmlContent();
            response.writeHead(200, {
                'Content-Length': html.length,
                'Content-Type': 'text/html'
            });
            response.end(html);
        }
    };
};

module.exports = mod;
