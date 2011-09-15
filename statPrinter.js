var mod = function(statusProvider) {
    var that = this;
    that.statusProvider = statusProvider;

    that.print = function() {
        console.log("-------------");
        for (var i in that.statusProvider) {
            console.log(that.statusProvider[i]());
        }
    }

    setInterval(that.print, 1000);
}

module.exports = mod;
