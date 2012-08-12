#!/bin/bash
export DISPLAY=:1

CACHEMIN=100000
CACHEFILL=130000

function getParasoupsLeft {
    echo $(mongo --quiet localhost:27018/parasoup --eval "db.parasoup.cache.find().count()")
}

while [ 1 ]; do
    CACHELEFT=$(getParasoupsLeft)
    if [ $CACHELEFT -lt $CACHEMIN ]; then
        echo "cache left: $CACHELEFT, filling cache to $CACHEFILL"
        while [ $CACHELEFT -lt $CACHEFILL ]; do
            phantomjs crawler.js
            CACHELEFT=$(getParasoupsLeft)
            sleep 1
        done
    else
        date
        echo "cache left: $CACHELEFT, nothing to do, waiting for $CACHEMIN"
    fi
    sleep 60
done
