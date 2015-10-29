#!/bin/bash
cd ~/node.luckynode.com
cat /etc/network/interfaces | awk '{$1=$1};1' > interfaces 