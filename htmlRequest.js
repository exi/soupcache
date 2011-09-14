var url = require('url'),
    http = require('http'),
    util = require('util');
    mod = function(options) {
        return function(request, response) {
            var that = this;
            that.request = request;
            that.response = response;
            that.soupData = null;
            that.soupDataLength = 0;

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
                return that.subDomain + "soup.io";
            }

            that.getOptionsForRequest = function() {
                var subdomain = that.subDomain;
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
                var newheaders = {};
                for (var i in headers) {
                    newheaders[i] = headers[i];
                }

                if (newheaders.location) {
                    newheaders.location = that.getNewResponseLocationField(newheaders.location);
                }

                newheaders['content-length'] = that.soupDataLength;

                return newheaders;
            };

            that.getSoupResponseData = function() {
                return that.soupData.slice(0, that.soupDataLength);
            };

            that.getModifiedSoupResponseData = function() {
                console.log("subdomain:"+that.subDomain);

                var newdata = that.soupData.toString();
                newdata = newdata.replace(
                        /asset\.soup\.io/g, "asset." + options.domain);

                var buf = new Buffer(newdata);
                that.soupDataLength = Buffer.byteLength(newdata, 'binary');
                return buf;
            };

            that.writeResponseHead = function() {
                that.response.writeHead(that.soupResponse.statusCode,
                        that.getModifiedSoupResponseHeaders(that.soupResponse.headers));
            }

            that.onSoupData = function(chunk) {
                that.soupData.write(chunk, that.soupDataLength, 'binary');
                that.soupDataLength += Buffer.byteLength(chunk, 'binary');
            };

            that.onSoupEndTransform = function() {
                var data = that.getModifiedSoupResponseData();
                that.writeResponseHead();
                if (that.soupDataLength > 0) {
                    var pos = 0;
                    console.log("write:"+that.response.write(data));
                }
                that.response.end();
            };

            that.onSoupEnd = function() {
                that.writeResponseHead();
                if (that.soupDataLength > 0) {
                    that.response.write(that.getSoupResponseData());
                }
                that.response.end();
            };

            that.shouldTransformData = function(headers) {
                var textTypeRegex = /text/,
                    applicationTypeRegex = /application/;

                if (!headers['content-type']) {
                    return true;
                } else if (headers['content-type'].search(textTypeRegex) != -1) {
                    return true;
                } else if (headers['content-type'].search(applicationTypeRegex) != -1) {
                    return true;
                }

                return false;
            };

            that.onSoupResponse = function(res) {
                that.soupResponse = res;
                var bufsize = res.headers['content-length']?parseInt(res.headers['content-length']):options.maxFileSize;
                that.soupData = new Buffer(bufsize);
                res.setEncoding('binary');
                res.on('data', that.onSoupData);

                if (that.shouldTransformData(res.headers)) {
                    console.log("transform");
                    res.on('end', that.onSoupEndTransform);
                } else {
                    res.on('end', that.onSoupEnd);
                }
            };

            that.onSoupError = function(error) {
                console.log("error:"+error.message);
                that.response.end("<html><body>Error while connecting to Soup:<div>" +
                        error.message +
                        "</div></body></html>");
            };

            that.setEncodingToPlaintext = function(headers) {
                headers['accept-encoding'] = 'identity';
                return headers;
            };

            that.setNewRequestHost = function(headers) {
                headers['host'] = that.getSoupDomain();
                return headers;
            };

            that.setNewReferrer = function(headers) {
                if (headers['referer']) {
                    headers['referer'] = headers['referer'].replace(new RegExp(options.domain), "soup.io");
                }
                return headers;
            };

            that.getModifiedSoupRequestHeader = function(headers) {
                headers = that.setNewRequestHost(headers);
                headers = that.setNewReferrer(headers);
                headers = that.setEncodingToPlaintext(headers);
                return headers;
            };

            that.onRequestData = function(chunk) {
                that.proxy_request.write(chunk);
            };

            that.onRequestEnd = function() {
                that.proxy_request.end();
            };

            that.respondeWithOriginalPage = function() {
                var subDomain = that.getSubDomain();
                subDomain = subDomain?subDomain + "." : "";
                that.subDomain = subDomain;

                console.log(that.request.method+" "+that.getSoupDomain()+" "+that.request.url);
                that.proxy = http.createClient(80, that.getSoupDomain());
                var newHeaders = that.getModifiedSoupRequestHeader(that.request.headers);
                that.proxy_request = that.proxy.request(
                    that.request.method,
                    that.request.url,
                    newHeaders);

                that.request.setEncoding('binary');
                that.proxy_request.on('response', that.onSoupResponse);
                that.proxy_request.on('error', that.onSoupError);
                that.request.on('data', that.onRequestData);
                that.request.on('end', that.onRequestEnd);
            };

            try {
                that.respondeWithOriginalPage();
            } catch (e) {
                console.error("error:" + e.message);
                that.response.end();
            }
        };
    };

module.exports = mod;
