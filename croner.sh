#!/bin/bash
cd ~/node.luckynode.com

#STATUS="Hello World!"
#echo $STATUS
#git fetch origin
#STATAS=$(git log HEAD..origin/master --oneline)
#echo $STATAS

#if ! git --git-dir=".git" diff --quiet
#then
#    echo thereischange
#    git reset --hard origin/master
#    git fetch --all
#    forever restart nodeluckynode
#else
#    echo nochange
#fi
#date



git fetch origin
reslog=$(git log HEAD..origin/master --oneline)
if [[ "${reslog}" != "" ]] ; then
    echo thereischange
    git merge origin/master # completing the pull
else
    echo nochange
fi