var mod = function(statusProvider, statsPerSecond) {
    var lastOutput = "";

    var start = new Date();
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
            var hours = Math.floor((new Date() - start) / 3600000 * 1000) / 1000;
            var text = "------" + new Date() + "-------\n";
            text += "running since " + start + " (" + hours + " h)";
            console.log(text);
            console.log(output);
            lastOutput = output;
        }
    }

    setInterval(print, Math.floor(1000 / statsPerSecond));

    return {
        getStatus: function() {
            return getOutput();
        }
    }
}

module.exports = mod;
