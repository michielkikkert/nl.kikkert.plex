/* jslint node: true */

'use strict';

var async = require('async'),
    Section = require('./section');

var ShowSection = Section.extend({
    constructor: function (server, json) {
        var me = this;
        me._super(arguments);
    },

    getShows: function(callback) {
        var me = this;

        me.server.plexRequest.get('/library/sections/' + me.key + '/all', function(err, shows) {
            callback(err, shows.map(function(show) {
                return me.server.plexFactory.createItem(show);
            }));
        });
    },

    getShow: function(title, callback) {
        var me = this,
            matchingShow = null;

        me.getShows(function (error, shows) {
            shows.some(function(show) {
                if (show.title.toLowerCase().indexOf(title.toLowerCase()) > -1) {
                    matchingShow = show;
                }

                return !!matchingShow;
            });

            callback(null, matchingShow);
        });
    }
});

module.exports = ShowSection;