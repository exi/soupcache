var url = require('url'),
    http = require('http'),
    util = require('util');

var mod = function(options) {
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
                if (that.soupDataLength > 0) {
                    var buf = null;
                    var newdata = that.soupData.toString();
                    if (newdata.search(/<\/html>/) != -1) {
                        var lines = newdata.split("\n");
                        for (var i in lines) {
                            if (lines[i].search(/Permalink/) == -1) {
                                lines[i] = replaceSoupLinksInString(lines[i]);
                            }
                        }

                        buf = new Buffer(lines.join("\n"));
                    } else {
                        buf = new Buffer(replaceSoupLinksInString(newdata));
                    }

                    that.soupDataLength = buf.length;
                    return buf;
                } else {
                    return new Buffer('');
                }
            };

            var replaceSoupLinksInString = function(inputdata) {
                return inputdata.replace(/soup\.io/g, options.domain);
            }

            that.writeResponseHead = function() {
                that.response.writeHead(that.soupResponse.statusCode,
                        that.getModifiedSoupResponseHeaders(that.soupResponse.headers));
            }

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

            that.onSoupData = function(chunk) {
                that.soupData.write(chunk, that.soupDataLength, 'binary');
                that.soupDataLength += Buffer.byteLength(chunk, 'binary');
            };

            that.onSoupEndTransform = function() {
                var data = that.getModifiedSoupResponseData();
                that.writeResponseHead();
                if (that.soupDataLength > 0 && that.request.method != 'HEAD') {
                    options.stats.dataCount[that.request.connection.remoteAddress] += that.soupDataLength;
                    that.response.write(data);
                }
                that.response.end();
            };

            that.onSoupEnd = function() {
                that.writeResponseHead();
                if (that.soupDataLength > 0 && that.request.method != 'HEAD') {
                    var data = that.getSoupResponseData();
                    options.stats.dataCount[that.request.connection.remoteAddress] += that.soupDataLength;
                    that.response.write(data);
                }
                that.response.end();
            };

            that.onSoupResponse = function(res) {
                that.soupResponse = res;
                var bufsize = res.headers['content-length']?parseInt(res.headers['content-length']):0;
                that.soupData = new Buffer(bufsize);
                res.setEncoding('binary');
                res.on('data', that.onSoupData);

                if (that.shouldTransformData(res.headers)) {
                    res.on('end', that.onSoupEndTransform);
                } else {
                    res.on('end', that.onSoupEnd);
                }
            };

            that.onSoupError = function(error) {
                console.trace();
                console.log("error:"+error.message);
                that.response.end();
            };

            that.onRequestData = function(chunk) {
                that.proxy_request.write(chunk);
            };

            that.onRequestEnd = function() {
                that.proxy_request.end();
            };

            that.onRequestTimeout = function() {
                console.error("aborting request");
                that.proxy_request.abort();
                that.response.end();
            }

            that.respondeWithOriginalPage = function() {
                var subDomain = that.getSubDomain();
                subDomain = subDomain?subDomain + "." : "";
                that.subDomain = subDomain;

                var newHeaders = that.getModifiedSoupRequestHeader(that.request.headers);
                that.proxy_request = http.request({
                    host: that.getSoupDomain(),
                    port: 80,
                    method: that.request.method,
                    path: that.request.url,
                    headers: newHeaders
                });

                that.proxy_request.setTimeout(options.timeout, that.onRequestTimeout);
                that.proxy_request.on('response', that.onSoupResponse);
                that.proxy_request.on('error', that.onSoupError);
                that.request.setEncoding('binary');
                that.request.on('data', that.onRequestData);
                that.request.on('end', that.onRequestEnd);
            };

            try {
                that.respondeWithOriginalPage();
            } catch (e) {
                console.error("error:" + e.message);
            }
        };
    };

module.exports = mod;
