#!/bin/bash
cd ~/node.luckynode.com
if ! git --git-dir=".git" diff --quiet
then
    echo thereischange
    git reset --hard origin/master
    git fetch --all
    forever restart nodeluckynode
else
    echo nochange
fi
