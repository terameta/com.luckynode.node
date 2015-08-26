#!/bin/bash
cd ~/node.luckynode.com
forever -a --minUptime 1000 --spinSleepTime 5000 --uid "nodeluckynode" start server/app.js