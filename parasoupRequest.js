var fs = require('fs');
var mod = function(options) {
    var clients = [],
        assetCache = [],
        assetCacheFile = options.cachePath + "parasoupAssetCache.json",
        getHtmlContent = function() { return fs.readFileSync("./parasoup.html", encoding='utf-8'); },
        served = 0;
        stallTimer = null;

    options.eventBus.on('newAsset', function(url, buffer, contentType) {
        if (buffer.length > 16 * 1024) {
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
        var response = "http://asset." + options.domain + data.url;
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
            var index = Math.floor(Math.random()*assetCache.length);
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

    return function(request, response) {
        if (request.url == "/newStuff") {
            clients.push({
                request: request,
                response: response
            });
        } else {
            response.end(getHtmlContent());
        }
    };
};

module.exports = mod;
