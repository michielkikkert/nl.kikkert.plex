/* jslint node: true */

'use strict';

var async = require('async'),
    Item = require('./item');

var Season = Item.extend({
    constructor: function (server, json) {
        var me = this;
        me._super(arguments);
    },

    getEpisodes: function (callback) {
        var me = this;

        async.waterfall([
            function (next) {
                me.server.plexRequest.get(me.key, next);
            },
            function(episodes, next) {
                next(null, episodes.map(me.server.plexFactory.createItem.bind(me)));
            }
        ], callback);
    },

    getEpisode: function(number, callback) {
        var me = this,
            matchingEpisode = null;

        me.getEpisodes(function (error, episodes) {
            episodes.some(function(episode) {
                if (episode.index == number) {
                    matchingEpisode = episode;
                }

                return !!matchingEpisode;
            });

            callback(null, matchingEpisode);
        });
    }
});

module.exports = Season;