var cache = require('cache.js')({cachePath:"./cache/", loadingCachePath:"./loading/"}),
    maxfilesize = 999999,
    testfilename = "test.jpg";

console.log(cache.exists(testfilename));
var buf = new Buffer(maxfilesize);
buf.write('aaaaaaaaaaaaaaaaaaaaa');
cache.insert(testfilename, buf);
console.log(cache.exists(testfilename));
