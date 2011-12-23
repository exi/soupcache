var mod = function(statusProvider) {
    var lastOutput = "";

    var getOutput = function() {
        var output = "";

        for (var i in statusProvider) {
            var lineend = i < statusProvider.length - 1?"\n":"";
            output += statusProvider[i]() + lineend;
        }

        return output
    }

    var print = function() {
        var output = getOutput();
        if (output != lastOutput) {
            console.log(output);
            lastOutput = output;
        }
    }

    setInterval(print, 250);

    return {
        getStatus: function() {
            return getOutput();
        }
    }
}

module.exports = mod;
