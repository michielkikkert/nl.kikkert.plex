/* jslint node: true */

'use strict';

var async = require('async'),
    Section = require('./section');

var MovieSection = Section.extend({
    constructor: function (server, json) {
        var me = this;
        me._super(server, json);
    },

    getMovies: function(callback) {
        var me = this;

        async.waterfall([
            function (next) {
                me.server.plexRequest.get('/library/sections/' + me.key + '/all', next);
            },
            function(movies, next) {
                next(null, movies.map(me.server.plexFactory.createItem.bind(me)));
            }
        ], callback);
    },

    getMovie: function(title, callback) {
        var me = this,
            matchingMovie = null;

        me.getMovies(function (error, movies) {
            movies.some(function(movie) {
                if (movie.title.toLowerCase().indexOf(title.toLowerCase()) > -1) {
                    matchingMovie = movie;
                }

                return !!movie;
            });

            callback(null, matchingMovie);
        });
    }
});

module.exports = MovieSection;