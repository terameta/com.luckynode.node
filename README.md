# node.luckynode.com
# Node System for Luckynode cloud management system. 

## Install

You can install this package with `npm`

### npm

* cd
* mkdir node.luckynode.com
* cd node.luckynode.com
* git init
* git remote add origin https://alirizadikici@bitbucket.org/alirizadikici/com.luckynode.node.git
* git pull origin master
* npm install nodemon -g
* npm install node-gyp -g
* cd node_modules
* git clone git://github.com/c4milo/node-libvirt.git
* cd node-libvirt
* node-gyp configure
* node-gyp build
* npm link
* cd ../../
* npm link libvirt
* npm install
* nodemon

## License

Closed License

Copyright (c) LuckyNode. http://luckynode.com
