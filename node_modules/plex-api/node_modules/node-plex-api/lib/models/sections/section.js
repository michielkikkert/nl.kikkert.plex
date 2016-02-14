/* jslint node: true */

'use strict';

var Class = require('class-js2'),
    _ = require('lodash');

var Section = Class.create({
    constructor: function (server, json) {
        var me = this;
        _.extend(me, json);
        me.server = server;
    },

    getUnwatched: function (callback) {
        var me = this;
        me.server.plexRequest.get('/library/sections/' + me.key + '/unwatched', callback);
    },

    getRecentlyAired: function (callback) {
        var me = this;

        me.server.plexRequest.get('/library/sections/' + me.key + '/newest', function (err, recentlyAired) {
            callback(err, recentlyAired.map(me.server.plexFactory.createItem));
        });
    },

    getRecentlyAdded: function (callback) {
        var me = this;
        me.server.plexRequest.get('/library/sections/' + me.key + '/recentlyAdded', callback);
    },

    getRecentlyViewed: function (callback) {
        var me = this;
        me.server.plexRequest.get('/library/sections/' + me.key + '/recentlyViewed', callback);
    },

    getOnDeck: function (callback) {
        var me = this;
        me.server.plexRequest.get('/library/sections/' + me.key + '/onDeck', callback);
    }
});

module.exports = Section;