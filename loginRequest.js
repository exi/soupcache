var mod = function(options) {
    return function(request, response) {
        var html = "<html><body>Sorry, but for privacy reasons, we can't allow a login through the proxy</body></html>";
        response.writeHead(200, {
            'Content-Length': html.length,
            'Content-Type': 'text/html'
        });
        response.end(html);
    };
};

module.exports = mod;
