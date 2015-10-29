#!/bin/bash
cd ~/node.luckynode.com
cat /etc/network/interfaces | awk '{$1=$1};1' > interfaces
mv interfaces /etc/network/interfaces