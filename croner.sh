#!/bin/bash
cd ~/node.luckynode.com
if ! git --git-dir=".git" diff --quiet
then
    git fetch --all
    git reset --hard origin/master
    forever restart nodeluckynode
fi
