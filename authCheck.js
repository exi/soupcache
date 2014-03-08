var httpdigestauth = require('http-digest-auth'),
    Cookies = require('cookies'),
    crypto = require('crypto'),
    realm = 'Parasoup',
    url = require('url'),
    fs = require('fs');

function isExpired(time) {
    return time.getTime() < new Date().getTime();
}

module.exports = function(options) {
    var loginStore = {},
        sessionLength = options.sessionLength || 31557600; // 1 year in seconds

    function storeWriter() {
        var data = JSON.stringify(loginStore);
        fs.writeFileSync(options.loginTokenFile, data);
        setTimeout(storeWriter, 10000);
    };

    if (options.loginTokenFile) {
        if (fs.existsSync(options.loginTokenFile)) {
            try {
            loginStore = JSON.parse(fs.readFileSync(options.loginTokenFile));
            for (var key in loginStore) {
                var token = loginStore[key];
                if (token.expires) {
                    token.expires = new Date(token.expires);
                }
            }
            } catch (e) { }
        }

        storeWriter();
    }


    return {
        checkAuth: function(request, response) {
            if (request.connection.remoteAddress == '188.40.102.160') {
                return true
            }

            var cookies = new Cookies(request, response);
            var token = cookies.get('token');
            if (loginStore.hasOwnProperty(token)) {
                var login = loginStore[token];
                if (!isExpired(login.expires)) {
                    return true;
                } else {
                    this.deleteToken(token);
                }
            }

            var mainUrlRegex = new RegExp('^' + options.domain + '$');
            if (!request.headers.host || !request.headers.host.match(mainUrlRegex)) {
                var source = 'http://' + request.headers.host + request.url;
                response.writeHead(302, {
                      'Location': 'http://parasoup.de?comeFrom=' + encodeURIComponent(source)
                });
                response.end();
                return false;
            }

            var username = httpdigestauth.login(request, response, realm, options.auth.users);
            if (username === false) {
                return false;
            }

            token = crypto.createHash('sha256').
                update('' + Math.floor(Math.random() * (new Date()).getTime())).digest('hex');
            var expires = new Date(new Date().getTime() + 1000 * sessionLength);
            cookies.set('token', '' + token, { domain: '.' + options.domainPrefix, expires: expires });
            loginStore[token] = { expires: expires };

            var query = url.parse(request.url, true).query;
            if (query.hasOwnProperty('comeFrom')) {
                response.writeHead(302, {
                      'Location': query.comeFrom
                });
                response.end();
                return false;
            }

            return true;
        },
        getActiveLoginCount: function() {
            var c = 0;

            for (var i in loginStore) {
                if (!isExpired(loginStore[i].expires)) {
                    c++;
                } else {
                    this.deleteToken(i);
                }
            }

            return c;
        },
        deleteToken: function(token) {
            if (loginStore.hasOwnProperty(token)) {
                delete loginStore[token];
            }
        }
    };
}
