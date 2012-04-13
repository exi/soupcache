var fs = require('fs'),
    temp = require('temp'),
    mime = require('mime-magic');

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
    try {
        mime.fileWrapper(fileinfo.path, function(err, type) {
            if (err) {
                cb(err);
            } else {
                closeAndReturnType(fileinfo, type, cb);
            }
        });
    } catch (e) {
        closeAndReturnError(fileinfo, e, cb);
    }
};

var closeAndReturnType = function(fileinfo, type, cb) {
    fs.close(fileinfo.fd, function(err) {
        temp.cleanup();
        if (err) {
            cb(err);
        } else {
            cb(null, type);
        }
    });
};

var closeAndReturnError = function(fileinfo, error, cb) {
    fs.close(fileinfo.fd, function(err) {
        temp.cleanup();
        if (err) {
            cb(err);
        } else {
            cb(error);
        }
    });
};

module.exports = {
    getBufferMimeType: function(buffer, cb) {
        getBufferMimeType(buffer, cb);
    }
};
