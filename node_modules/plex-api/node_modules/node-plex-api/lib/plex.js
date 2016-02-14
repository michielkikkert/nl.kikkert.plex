/* jslint node: true */

'use strict';

var Class = require('class-js2'),
    _ = require('lodash'),
    baseConfig = require('./config/config'),
    configValidator = require('./config/config-validator'),
    PlexRequest = require('./helpers/plex-request'),
    PlexFactory = require('./models/factory'),
    async = require('async');

var PlexServer = Class.extend({
    constructor: function (config) {
        var me = this,
            mergedConfig = _.extend(baseConfig, config);

        configValidator(mergedConfig);
        _.extend(me, mergedConfig);

        me.sections = null;
        me.isAuthenticated = !me.isRemote;
        me.plexRequest = new PlexRequest(me);
        me.plexFactory = new PlexFactory(me);
    },

    authenticate: function (callback) {
        var me = this;

        if (me.isAuthenticated) {
            callback(null);
        } else {
            me.plexRequest.auth(function () {
                me.isAuthenticated = true;
                callback(null);
            });
        }
    },

    getSections: function (callback) {
        var me = this;

        if (me.sections === null) {
            async.waterfall([
                me.authenticate.bind(me),
                function (next) {
                    me.plexRequest.get('/library/sections', next);
                },
                function (sections, next) {
                    var sectionObjects = [];

                    sections.forEach(function (section) {
                        sectionObjects.push(me.plexFactory.createSection(section));
                    });

                    me.sections = sectionObjects;
                    next(null, sectionObjects);
                }
            ], callback);
        } else {
            callback(null, me.sections);
        }
    },

    getSection: function (type, callback) {
        var me = this;

        function filterSection(sections, next) {
            var sectionToReturn = null;

            sections.some(function (section) {
                if (type === section.type) {
                    sectionToReturn = section;
                }

                return !!sectionToReturn;
            });

            next(null, sectionToReturn);
        }

        if (me.sections === null) {
            async.waterfall([
                me.authenticate.bind(me),
                me.getSections.bind(me),
                filterSection
            ], callback);
        } else {
            filterSection(me.sections, callback);
        }
    }
});

module.exports = PlexServer;