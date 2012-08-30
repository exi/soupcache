var fs = require('fs'),
    path = require('path'),
    mime = require('mime-magic');

var getRandomName = function() {
  var now = new Date();
  var name = ['parasoup', now.getYear(), now.getMonth(), now.getDay(),
              '-',
              process.pid,
              '-',
              (Math.random() * 0x100000000 + 1).toString(36)].join('');
  return name;
}

var getBufferMimeType = function(buffer, cb) {
    var info = {
        path: path.join(fs.realpathSync('/tmp'), getRandomName())
    };
    fs.open(info.path, 'w+', 0600, function(err, fd) {
        if (err) {
            cb(err);
        } else {
            info.fd = fd;
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
        closeDeleteAndReturnError(fileinfo, e, cb);
    }
};

var closeAndDelete = function(info) {
    fs.closeSync(info.fd);
    fs.unlinkSync(info.path);
};

var closeAndReturnType = function(fileinfo, type, cb) {
    closeAndDelete(fileinfo);
    cb(null, type);
};

var closeDeleteAndReturnError = function(fileinfo, error, cb) {
    closeAndDelete(fileinfo);
    cb(error);
};

module.exports = {
    getBufferMimeType: function(buffer, cb) {
        getBufferMimeType(buffer, cb);
    }
};
