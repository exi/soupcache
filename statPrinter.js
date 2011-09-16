var mod = function(statusProvider) {
    var that = this;
    that.statusProvider = statusProvider;
    that.lastOutput = "";

    that.print = function() {
        var output = "";
        for (var i in that.statusProvider) {
            var lineend = i < that.statusProvider.length - 1?"\n":"";
            output += that.statusProvider[i]() + lineend;
        }

        if (output != that.lastOutput) {
            console.log("------" + new Date() + "-------");
            console.log(output);
            that.lastOutput = output;
        }
    }

    setInterval(that.print, 250);
}

module.exports = mod;
