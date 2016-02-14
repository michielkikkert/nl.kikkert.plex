/* jslint node: true */

'use strict';

var _ = require('lodash'),
    async = require('async'),
    Item = require('./item');

var Show = Item.extend({
    constructor: function (server, json) {
        var me = this;
        me._super(arguments);
    },

    getSeasons: function (callback) {
        var me = this;

        me.server.plexRequest.get(me.key, function (error, seasons) {
            var mappedSeasons = [];

            seasons.forEach(function (season) {
                if (season.type) {
                    mappedSeasons.push(me.server.plexFactory.createItem(season));
                }
            });

            callback(error, mappedSeasons);
        });
    },

    getSeason: function (number, callback) {
        var me = this,
            matchingSeason = null;

        me.getSeasons(function (error, seasons) {
            seasons.some(function (season) {
                if (season.index == number) {
                    matchingSeason = season;
                }

                return !!matchingSeason;
            });

            callback(null, matchingSeason);
        });
    },

    getEpisodes: function (callback) {
        var me = this;

        me.getSeasons(function (error, seasons) {
            async.mapSeries(seasons, function (season, next) {
                season.getEpisodes(function (error, episodes) {
                    next(error, episodes.map(function (episode) {
                        episode.season = season;
                        return episode;
                    }));
                });
            }, function (error, seasonEpisodes) {
                callback(error, _.flatten(seasonEpisodes));
            });
        });
    }
});

module.exports = Show;