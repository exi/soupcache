var fs = require('fs'),
    temp = require('temp'),
    mime = require('mime-magic');

var getFileMimeType = function(cacheName, callback) {
    try {
        mime.fileWrapper(cacheName, function(err, type) {
            if (err) {
                // assume text/html
                callback('text/html');
            } else {
                callback(type);
            }
        });
    } catch (e) {
        // assume text/html
        callback('text/html');
    }
};

var getBufferMimeType = function(buffer, cb) {
    temp.open('parasoup', function(err, info) {
        if (err) {
            cb(err);
        } else {
            writeAndGetType(buffer, info, cb);
        }
    });
};

var writeAndGetType = function(buffer, fileinfo, cb) {
    fs.write(fileinfo.fd, buffer, 0, buffer.length, 0, function(err, writter) {
        if (err) {
            cb(err);
        } else {
            getTypeAndClose(fileinfo, cb);
        }
    });
};

var getTypeAndClose = function(fileinfo, cb) {
    mime.fileWrapper(fileinfo.path, function(err, type) {
        if (err) {
            cb(err);
        } else {
            closeAndReturnType(fileinfo, type, cb);
        }
    });
};

var closeAndReturnType = function(fileinfo, type, cb) {
    fs.close(fileinfo.fd, function(err) {
        if (err) {
            cb(err);
        } else {
            cb(null, type);
        }
    });
};

module.exports = {
    getBufferMimeType: function(buffer, cb) {
        getBufferMimeType(buffer, cb);
    }
};
