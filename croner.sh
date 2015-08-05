#!/bin/bash
cd ~/node.luckynode.com

STATUS="Hello World!"
echo $STR
STATUS=git --git-dir=".git" diff --quiet
echo $STR            
            
if ! git --git-dir=".git" diff --quiet
then
    echo thereischange
    git reset --hard origin/master
    git fetch --all
    forever restart nodeluckynode
else
    echo nochange
fi
