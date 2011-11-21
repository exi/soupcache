var fs = require('fs');
var mod = function(options) {
    var clients = [],
        getHtmlContent = function() { return fs.readFileSync("./parasoup.html", encoding='utf-8'); },
        assetCache = [],
        stallTimer = null;

    options.eventBus.on('newAsset', function(url, buffer, contentType) {
        if (buffer.length > 16 * 1024) {
            var data = {url: url};
            if (clients.length > 0) {
                deliverToClients(data);
            } else {
                assetCache.push(data);
                options.stats.parasoupAssetCache++;
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
                options.stats.parasoups++;
            } catch (e) {
                //dont care
            }
        }
        clients = [];
    };

    var onStallTimer = function() {
        removeStallTimer();

        if (assetCache.length > 0 && clients.length > 0) {
            var data = assetCache[0];
            deliverToClients(data);
            assetCache.splice(0, 1);
            options.stats.parasoupAssetCache--;
        } else {
            resetStallTimer();
        }
    }

    var removeStallTimer = function() {
        if (stallTimer !== null) {
            clearTimeout(stallTimer);
            stallTimer = null;
        }
    }

    var resetStallTimer = function() {
        removeStallTimer();
        stallTimer = setTimeout(onStallTimer, 2000);
    }

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
