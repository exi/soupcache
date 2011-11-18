var fs = require('fs');
var mod = function(options) {
    var clients = [],
        getHtmlContent = function() { return fs.readFileSync("./parasoup.html", encoding='utf-8'); };

    options.eventBus.on('newAsset', function(url, buffer, contentType) {
        if (buffer.length > 16 * 1024) {
            var response = "http://asset." + options.domain + url;
            for (var i = 0; i<clients.length; i++) {
                try{
                    clients[i].response.writeHead(200, {
                        'Content-Length': response.length,
                        'Content-Type': 'text/plain'
                    });
                    clients[i].response.end(response);
                } catch(e) {
                    //dont care
                }
            }
            clients = [];
        }
    });


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
