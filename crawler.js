var fs = require('fs');
var loadEveryone;
var loaded = {
    "http://www.parasoup.de": true,
    "http://www.parasoup.de/friends": true,
    "http://static.parasoup.de": true,
    "http://static.parasoup.de/friends": true
};
var todo = ["http://www.parasoup.de/everyone"];
var running = 0;
var maxRunning = 1;
var runsDone = 0;
var runLimit = 1;

var next = function() {
    if (runsDone >= runLimit && running == 0) { phantom.exit(); }
    while (running < maxRunning && todo.length > 0 && runsDone < runLimit) {
        var url = todo.shift();
        console.log(todo.length + " in queue");
        loadPage(url);
    }
};

var dlFinish = function() {
    running--;
    console.log(runsDone + "/" + runLimit + " (" + running + " running)");
    saveState();
    setTimeout(next, 0);
};

var saveState = function() {
    fs.write("page.json", JSON.stringify({todo: todo, loaded: loaded}), "w");
};

var loadState = function() {
    console.log("loading");
    try {
        var options = eval("("+fs.read("page.json")+")");
        if (options) {
            if (options.hasOwnProperty("todo") && options.todo.length > 0) {
                todo = options.todo;
            }
            if (options.hasOwnProperty("loaded")) {
                loaded = options.loaded;
            }
        }
    } catch (e) {
        //ignore
        console.error(e);
    }
};

function waitFor(tickFunc, callback, timeOutMillis) {
    var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 5000, //< Default Max Timout is 3s
        start = new Date().getTime(),
        interval = setInterval(function() {
            if ( (new Date().getTime() - start < maxtimeOutMillis)) {
                // If not time-out yet
                var end = tickFunc() === true;
                if (end) {
                    clearInterval(interval);
                    callback();
                }
            } else {
                clearInterval(interval); //< Stop this interval
                callback();
            }
        }, 1000); //< repeat check every second
};

var loadPage = function(url) {
    running++;
    runsDone++;
    console.log("start " + url);
    var page = new WebPage();
    var done = false;
    var lastpos = 0;
    var lastincrease = new Date();

    page.open(url, function(status) {
        if (!done) {
            done = true;
            page.onLoadFinished = function() {};
            console.log("done " + status + " " + url);
            if (status != "success") {
                if (todo.indexOf(url) == -1 && !loaded.hasOwnProperty(url))
                    todo.push(url);
                dlFinish();
            } else {
                var readyfunc = function() {
                    var matches = page.evaluate(function() {
                        var soupregex = /http:\/\/[a-zA-Z0-9]*\.parasoup\.de/g;
                        var text = document.getElementsByTagName('body')[0].innerHTML;
                        return text.match(soupregex);
                    });
                    var before = todo.length;
                    for (var i in matches) {
                        var m = matches[i];
                        var fm = matches[i] + "/friends";
                        if (todo.indexOf(m) == -1 && !loaded.hasOwnProperty(m)) {
                            loaded[m] = true;
                            todo.push(m);
                        }
                        if (todo.indexOf(fm) == -1 && !loaded.hasOwnProperty(fm)) {
                            loaded[fm] = true;
                            todo.push(fm);
                        }
                    }
                    console.log("added " + (todo.length - before) + " to queue");
                };
                waitFor(function() {
                        var pos = page.evaluate(function() {
                            window.scrollTo(0, window.pageYOffset + 50000);
                            return window.pageYOffset;
                        });

                        if ( pos !== lastpos) {
                            console.log(url + " pos: " + pos);
                            readyfunc();
                            lastpos = pos;
                            lastincrease = new Date();
                        } else if (new Date() - lastincrease > 10000) {
                            console.log(url + " stopping because auf no change for 10 sec")
                            return true; //end
                        }
                    }, dlFinish, 6000000);
            }
        }
    });
};

loadState();
next();

