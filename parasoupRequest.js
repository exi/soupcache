var fs = require('fs'),
    Cache = require('./parasoupCache.js'),
    querystring = require('querystring'),
    crypto = require('crypto');
var soupInterval = 950;
var mod = function(options) {
    var clients = [],
        cache = null,
        cacheSize = null,
        cacheHandler = options.cacheHandler,
        getHtmlContent = function() {
            return fs.readFileSync('./parasoup.html', 'utf-8').replace(/\{\{\{COOKIE\}\}\}/g, getCookieContent());
        },
        getPopularContent = function() {
            return fs.readFileSync('./popular.html', 'utf-8').replace(/\{\{\{WAYPOINT\}\}\}/g, getWaypointContent());
        },
        getWaypointContent = function() {
            return fs.readFileSync('./waypoints.min.js', 'utf-8') + fs.readFileSync('./waypoints-sticky.min.js', 'utf-8');
        },
        getCookieContent = function() {
            return fs.readFileSync('./jquery.cookie.js', 'utf-8');
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
        var md5 = crypto.createHash('md5');
        md5.update(url);
        var response = 'http://asset-' + md5.digest('hex')[0] + '.' + options.domain + url;
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

    var sendPopularFiles = function(since, skip, request, response) {
        options.cacheHandler.getPopularFiles(20, since, skip, function(err, files) {
            if (err) {
                options.logger.error('sendPopularFiles', err);
                response.writeHead(500, {
                    'Content-Length': 0,
                    'Content-Type': 'text/html'
                });
                options.logger.access(request, 500, 0);
                return reponse.end();
            }

            files = files.map(function(item) {
                var md5 = crypto.createHash('md5');
                md5.update(item.path);
                return {
                    count: item.count,
                    url: 'http://asset-' + md5.digest('hex')[0] + '.' +  options.domainPrefix + item.path
                };
            });

            var ret = JSON.stringify(files);
            response.writeHead(200, {
                'Content-Length': ret.length,
                'Content-Type': 'application/json'
            });

            response.end(ret);

            options.logger.access(request, 200, ret.length);
        });
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

    var parseGetPopular = function(request, response) {
        var body = '';

        request.on('data', function(data) {
            body += data.toString();
            if (body.length > 10000) {
                request.socket.destroy();
                response.end();
            }
        });

        request.on('end', function() {
            var decodedBody = querystring.parse(body);
            var since = new Date();
            since.setDate(-30);
            var skip = 0;
            if (decodedBody) { 
                if (decodedBody.since) {
                    since = new Date(decodedBody.since * 1000);
                }
                if (decodedBody.skip) {
                    skip = parseInt(decodedBody.skip, 10);
                }
            }

            sendPopularFiles(since, skip, request, response);
        });
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
        } else if (request.url == '/getPopular?') {
            parseGetPopular(request, response);
        } else if (request.url == '/popular') {
            var html = getPopularContent();
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
