var url = require('url'),
    mod = function(options) {
        return function(request, response) {
            var api = {},
                that = this;
            that.request = request;
            that.response = response;


            response.writeHead(200);
            response.end();
        };
    };

module.exports = mod;
