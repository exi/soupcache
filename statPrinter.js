var mod = function(statusProvider, statsPerSecond) {
    var start = new Date();
    var getOutput = function() {
        var output = "";

        for (var i in statusProvider) {
            var lineend = i < statusProvider.length - 1?"\n":"";
            output += statusProvider[i]() + lineend;
        }

        return output
    }

    return {
        getStatus: function() {
            return getOutput();
        }
    }
}

module.exports = mod;
