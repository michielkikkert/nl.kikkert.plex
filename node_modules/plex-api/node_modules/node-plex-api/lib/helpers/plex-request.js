/* jslint node: true */

'use strict';

var Class = require('class-js2'),
    util = require('util'),
    request = require('request'),
    headers = require('./../config/headers'),
    xmlParser = require('../helpers/xml-parser');

var PlexRequest = Class.extend({
    constructor: function (server) {
        var me = this;
        me.server = server;
        me.acceptableResponseCodes = [200, 201];
    },

    sendRequest: function (method, section, callback) {
        var me = this,
            url = util.format('http://%s:%s%s', me.server.host, me.server.port, section),
            isAuthRequest = false,
            json,
            requestOptions = {
                url: url,
                method: method
            };

        // if we are making a remote request, build the headers and add basic auth
        if (me.server.isRemote) {
            if (!me.server.isAuthenticated) {
                isAuthRequest = true;
                requestOptions.auth = {
                    user: me.server.username,
                    pass: me.server.password
                };
            }

            requestOptions.headers = headers;
        }

        console.log('Plex Api Request ---> ', requestOptions.method, requestOptions.url);

        request(requestOptions, function (requestError, response, body) {
            if (requestError) {
                callback(requestError);
                return;
            }

            json = (isAuthRequest) ? xmlParser.parseAuthentication(body) : xmlParser.parseDirectories(body);

            if (me.acceptableResponseCodes.indexOf(response.statusCode) === -1) {
                return callback(json);
            }

            if (json.errors) {
                return callback(json.errors);
            }

            if (isAuthRequest) {
                headers['X-Plex-Token'] = json.authenticationToken;
            }

            return callback(null, json);
        });
    },

    get: function (section, callback) {
        var me = this;
        me.sendRequest('get', section, callback);
    },

    post: function (section, callback) {
        var me = this;
        me.sendRequest('post', section, callback);
    },

    auth: function (callback) {
        var me = this;
        me.sendRequest('post', 'https://my.plexapp.com/users/sign_in.xml', callback);
    }
});

module.exports = PlexRequest;