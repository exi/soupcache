var mod = function(options) {
        return function(request, response) {
            var html = "<html><head>";
            html += '<script type="text/javascript">' +
                    '   console.log("autorefresh");' +
                    '   window.setTimeout(function() {' +
                    '       window.location.reload(true)' +
                    '   }, 2000);' +
                    '</script>';
            html += "</head><body>" + options.statPrinter.getStatus() + "</body></html>";
            html = html.replace(/\n/g, "<br/>");
            response.writeHead(200, {
                'Content-Length': html.length,
                'Content-Type': 'text/html'
            });
            response.end(html);
        };
};

module.exports = mod;