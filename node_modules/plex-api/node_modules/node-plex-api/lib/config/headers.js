/* jslint node: true */

'use strict';

var os = require('os'),
    config = require('./config');

module.exports = {
    'X-Plex-Platform': (os.platform() === 'darwin') ? 'MacOSX' : os.platform(),
    'X-Plex-Platform-Version': os.release(),
    'X-Plex-Product-Version': config.applicationVersion,
    'X-Plex-Product': config.applicationName,
    'X-Plex-Client-Identifier': config.applicationIdentifier,
    'X-Plex-Token': null
};