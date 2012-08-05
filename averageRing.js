var AverageRing = function(size, calculateDiff) {
    this.size = parseInt(size);
    this.nextPosition = 0;
    this.used = 0;
    this.full = false;
    this.ring = new Array(this.size);
    this.lastValue = 0;
    this.calcDiff = calculateDiff === undefined ? true : false;
};

AverageRing.prototype.add = function(value) {
    if (!this.full) {
        if (++this.used === this.size) {
            this.full = true;
        }
    }

    this.ring[this.nextPosition] = {
        value: this.calcDiff ? value - this.lastValue : value,
        time: new Date()
    };

    if (this.calcDiff) {
        this.lastValue = value;
    }

    this.positionStep();
}


AverageRing.prototype.positionStep = function() {
    this.nextPosition = (++this.nextPosition) % (this.size);
}

AverageRing.prototype.getAverage = function(precision) {
    var avg = 0;
    var l = this.used;

    if (l === 0) {
        return 0;
    }

    precision = Math.pow(10, precision);
    for (var i = 0; i < l; i++) {
        var item = this.ring[i];
        avg += item.value;
    }

    avg = avg / l;

    return Math.floor(avg * precision) / precision;
}

AverageRing.prototype.getAveragePerTime = function(precision, projectionTimeMs) {
    var avg = 0;
    var l = this.used;
    var minTime = new Date().getTime();
    var maxTime = 0;

    if (l === 0) {
        return 0;
    }

    precision = Math.pow(10, precision);

    for (var i = 0; i < l; i++) {
        var item = this.ring[i];
        avg += item.value;
        minTime = Math.min(minTime, item.time.getTime());
        maxTime = Math.max(maxTime, item.time.getTime());
    }

    var timeDiff = maxTime - minTime;

    return Math.floor((avg / timeDiff) * projectionTimeMs * precision) / precision;
}

module.exports = AverageRing;
