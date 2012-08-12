var url = require('url'),
    fs = require('fs'),
    http = require('http');

var defaultMessage = [
    '<html><body>',
    'Maintenance, please stand by',
    '</body></html>'
].join('');

var mod = function(options) {
    return function(request, response) {
        fs.exists(options.maintenanceMessageFile, function(fexist) {
            if (fexist) {
                return respondeWithMaintFile();
            } else {
                return respondeWithoutMaintFile();
            }
        });

        function respondeWithMaintFile() {
            fs.readFile(options.maintenanceMessageFile, 'utf8', function(err, data) {
                if (err) {
                    return respondeWithoutMaintFile();
                } else {
                    response.writeHead(200, {
                        'Content-Length': data.length,
                        'Content-Type': 'text/html'
                    });
                    return response.end(data);
                }
            });
        }

        function respondeWithoutMaintFile() {
            response.writeHead(200, {
                'Content-Length': defaultMessage.length,
                'Content-Type': 'text/html'
            });
            return response.end(defaultMessage);
        }
    };
};

module.exports = mod;
