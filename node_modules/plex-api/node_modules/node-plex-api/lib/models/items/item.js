/* jslint node: true */

'use strict';

var Class = require('class-js2'),
    _ = require('lodash');

var Item = Class.create({
    constructor: function (server, json) {
        var me = this;
        me.server = server;
        _.extend(me, json);

    },

    getMetaData: function (callback) {
        var me = this;

        me.server.plexRequest.get(me.attributes.key, function (error, metaData) {
            me.metaData = metaData;
            callback(error, metaData);
        });
    }
});

module.exports = Item;