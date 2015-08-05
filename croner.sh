#!/bin/bash
cd ~/node.luckynode.com
if ! git --git-dir=".git" diff --quiet
then
    git reset --hard origin/master
    git fetch --all
    forever restart nodeluckynode
fi
