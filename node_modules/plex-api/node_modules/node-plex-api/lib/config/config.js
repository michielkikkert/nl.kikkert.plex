/* jslint node: true */

'use strict';

var packageJson = require('../../package.json');

module.exports = {
    sections: {
        shows: null,
        movies: null
    },
    remote: false,
    applicationName: 'Node Plex Api',
    applicationVersion: packageJson.version,
    applicationIdentifier: '8ef6fede-a547-4f9d-9865-e43bc3c4f190',
    port: 32400,
    responseFormat: 'json'
};