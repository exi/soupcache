#!/bin/bash

while [ 1 ];
    do node soupcache.js 2>>error.log;
    echo "-------restarting-------" | tee -a error.log;
    date | tee -a error.log
    sleep 0.5;
done
