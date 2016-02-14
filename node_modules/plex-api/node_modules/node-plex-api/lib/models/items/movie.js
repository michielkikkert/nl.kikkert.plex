/* jslint node: true */

'use strict';

var Item = require('./item');

var Movie = Item.extend({
    constructor: function (server, json) {
        var me = this;
        me._super(arguments);
    }
});

module.exports = Movie;