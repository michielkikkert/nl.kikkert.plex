/* jslint node: true */

'use strict';

module.exports = function (configuration) {
    if (!configuration.host) {
        throw new Error('Plex API requires a host');
    }

    if (!configuration.port) {
        throw new Error('Plex API requires a port');
    }

    if (!configuration.username) {
        throw new Error('Plex API requires a username');
    }

    if (!configuration.password) {
        throw new Error('Plex API requires a password');
    }
};