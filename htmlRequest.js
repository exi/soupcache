var url = require('url'),
    http = require('http'),
    util = require('util');
    mod = function(options) {
        return function(request, response) {
            var that = this;
            that.request = request;
            that.response = response;
            that.soupData = "";

            that.getSubDomain = function() {
                var subDomainRegex = new RegExp("(.*)\." + options.domain + ".*"),
                    results = null;
                results = that.request.headers.host.match(subDomainRegex);
                if (results && results[1]) {
                    return results[1];
                } else {
                    return null;
                }
            };

            that.getSoupDomain = function() {
                var subDomain = that.getSubDomain();
                subDomain = subDomain?subDomain + "." : "";
                return subDomain + "soup.io";
            }

            that.getOptionsForRequest = function() {
                var subdomain = that.getSubDomain();
                return {
                    host: host,
                    port: 80,
                    path: that.request.url
                };
            };

            that.getNewResponseLocationField = function(location) {
                return location.replace(/soup\.io/, options.domain);
            };

            that.getModifiedSoupResponseHeaders = function(headers) {
                if (headers.location) {
                    headers.location = that.getNewResponseLocationField(headers.location);
                }

                return headers;
            };

            that.getModifiedSoupResponseData = function() {
                return that.soupData.replace(/asset\.soup\.io/g, "asset." + options.domain);
            };

            that.onSoupData = function(chunk) {
                that.soupData += chunk;
            };

            that.onSoupEnd = function() {
                that.response.write(that.getModifiedSoupResponseData());
                that.response.end();
            };

            that.onSoupResponse = function(res) {
                that.response.writeHead(res.statusCode, that.getModifiedSoupResponseHeaders(res.headers))
                res.on('data', that.onSoupData);
                res.on('end', that.onSoupEnd);
            };

            that.setEncodingToPlaintext = function(headers) {
                headers['accept-encoding'] = 'text/plain';
                return headers;
            };

            that.setNewRequestHost = function(headers) {
                headers['host'] = that.getSoupDomain();
                return headers;
            };

            that.getModifiedSoupRequestHeader = function(headers) {
                headers = that.setNewRequestHost(headers);
                headers = that.setEncodingToPlaintext(headers);
                return headers;
            };

            that.onRequestData = function(chunk) {
                that.proxy_request.write(chunk);
            };

            that.onRequestEnd = function() {
                that.proxy_request.end();
            };

            that.onSoupError = function(error) {
                that.response.end("<html><body>Error while connecting to Soup:<div>" +
                        error.message +
                        "</div></body></html>");
            };

            that.respondeWithOriginalPage = function() {
                that.proxy = http.createClient(80, that.getSoupDomain());
                that.proxy_request = that.proxy.request(
                    that.request.method,
                    that.request.url,
                    that.getModifiedSoupRequestHeader(that.request.headers));

                that.proxy_request.on('response', that.onSoupResponse);
                that.proxy_request.on('error', that.onSoupError);
                that.request.setEncoding('binary');
                that.request.on('data', that.onRequestData);
                that.request.on('end', that.onRequestEnd);
            }

            that.respondeWithOriginalPage();
        };
    };

module.exports = mod;
