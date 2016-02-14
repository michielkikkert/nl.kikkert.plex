/* jslint node: true */

'use strict';

var Class = require('class-js2'),
    _ = require('lodash'),
    MovieSection = require('./sections/movie-section'),
    ShowSection = require('./sections/show-section'),
    Show = require('./items/show'),
    Season = require('./items/season'),
    Episode = require('./items/episode'),
    Movie = require('./items/movie');

var PlexFactory = Class.extend({
    constructor: function (server) {
        var me = this;
        me.server = server;
    },

    createSection: function (json) {
        var me = this;

        switch (json.type) {
            case 'show':
                return new ShowSection(me.server, json);
            case 'movie':
                return new MovieSection(me.server, json);
            default:
                throw new Error('Attempted to create an unknown Section type ' + json.type);
        }
    },

    createItem: function (json) {
        var me = this;

        switch (json.type) {
            case 'show':
                return new Show(me.server, json);
            case 'season':
                return new Season(me.server, json);
            case 'episode':
                return new Episode(me.server, json);
            case 'movie':
                return new Movie(me.server, json);
            default:
                throw new Error('Attempted to create an unknown Item type ' + json.type);
        }
    }
});

module.exports = PlexFactory;