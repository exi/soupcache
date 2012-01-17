var fs = require('fs');
var soupInterval = 2000; //2s
var mod = function(options) {
    var clients = [],
        assetCache = [],
        assetCacheFile = options.cachePath + "parasoupAssetCache.json",
        getHtmlContent = function() { return fs.readFileSync("./parasoup.html", 'utf-8'); },
        served = 0;
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
        fs.writeFileSync(assetCacheFile, JSON.stringify(assetCache));
    };

    var loadCacheFromDisc = function() {
        try {
            var stat = fs.statSync(assetCacheFile);
            if (stat.isFile()) {
                var content = fs.readFileSync(assetCacheFile);
                assetCache = JSON.parse(content);
                updateStats();
            }
        } catch (e) {
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
        stallTimer = setTimeout(onStallTimer, 2000);
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
