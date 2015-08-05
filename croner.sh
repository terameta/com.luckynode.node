#!/bin/bash
cd ~/node.luckynode.com

STATUS="Hello World!"
echo $STATUS
git fetch origin
STATAS=$(git log HEAD..origin/master --oneline)
echo $STATAS

if ! git --git-dir=".git" diff --quiet
then
    echo thereischange
    git reset --hard origin/master
    git fetch --all
    forever restart nodeluckynode
else
    echo nochange
fi
date