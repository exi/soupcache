var fs = require('fs');
var soupInterval = 950;
var mod = function(options) {
    var clients = [],
        assetCache = [],
        assetCacheFile = options.cachePath + "parasoupAssetCache.json",
        getHtmlContent = function() { return fs.readFileSync("./parasoup.html", 'utf-8'); },
        getNewHtmlContent = function() { return fs.readFileSync("./parasoupNew.html", 'utf-8'); },
        served = 0,
        cacheLoaded = false,
        stallTimer = null;

    options.eventBus.on('newAsset', function(url, buffer, contentType) {
        if (buffer.length > 30 * 1024) {
            var data = {url: url};
            if (clients.length > 0) {
                deliverToClients(data);
            } else {
                assetCache.push(data);
                writeCacheToDisc();
                updateStats();
            }
            resetStallTimer();
        }
    });

    var deliverToClients = function(data) {
        var response = "http://a.asset." + options.domain + data.url;
        for (var i = 0; i<clients.length; i++) {
            try{
                clients[i].response.writeHead(200, {
                    'Content-Length': response.length,
                    'Content-Type': 'text/plain'
                });
                clients[i].response.end(response);
                served++;
                updateStats();
            } catch (e) {
                //dont care
            }
        }
        clients = [];
    };

    var writeCacheToDisc = function() {
        try {
            if (cacheLoaded) {
                fs.writeFileSync(assetCacheFile, JSON.stringify(assetCache));
            }
        } catch (e) {
            console.error("error: " + e.message);
            console.error(e.stack);
        }
    };

    var loadCacheFromDisc = function() {
        try {
            if (fs.existsSync(assetCacheFile)) {
                var content = fs.readFileSync(assetCacheFile);
                try {
                    assetCache = JSON.parse(content);
                    if (!(assetCache instanceof Array)) {
                        assetCache = [];
                    }
                } catch (e) {
                    assetCache = [];
                }
                updateStats();
            }
            cacheLoaded = true;
        } catch (e) {
            console.error("error: " + e.message);
            console.error(e.stack);
            setTimeout(loadCacheFromDisc, 1000);
        }
    };

    var onStallTimer = function() {
        removeStallTimer();

        if (assetCache.length > 0 && clients.length > 0) {
            var l = assetCache.length;
            // Take from the last 100 added, this ensures that the cache somehow reflects the current time of the day
            var index = l -  Math.floor(Math.random() * Math.min(l, 100));
            index = Math.max(0, Math.min(l - 1, index));
            var data = assetCache[index];
            deliverToClients(data);
            assetCache.splice(index, 1);
            updateStats();
            writeCacheToDisc();
        }
        resetStallTimer();
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
            options.stats.parasoupAssetCache = assetCache.length;
            options.stats.parasoups = served;
    }

    loadCacheFromDisc();
    resetStallTimer();

    return function(request, response) {
        if (request.url == "/newStuff") {
            clients.push({
                request: request,
                response: response
            });
        } else if (request.url == "/newHTML") {
            var html = getNewHtmlContent();
            response.writeHead(200, {
                'Content-Length': html.length,
                'Content-Type': 'text/html'
            });
            response.end(html);
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
