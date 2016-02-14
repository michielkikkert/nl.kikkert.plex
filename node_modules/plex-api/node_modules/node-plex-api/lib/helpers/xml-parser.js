/* jslint node: true */

'use strict';

var _ = require('lodash'),
    xmldoc = require('xmldoc'),
    S = require('string');

function camelizeKeys(object) {
    var formattedObject = {};

    _.keys(object).forEach(function (key) {
        var formattedKey = S(key).camelize().s;

        if (formattedKey.length <= 1) {
            formattedKey = formattedKey.toLowerCase();
        } else {
            formattedKey = formattedKey.substring(0, 1).toLowerCase() + formattedKey.substring(1);
        }

        formattedObject[formattedKey] = object[key];

        if (object[key] instanceof Array) {
            formattedObject[formattedKey] = object[key];
        } else if (typeof object[key] === 'object') {
            formattedObject[formattedKey] = camelizeKeys(object[key]);
        } else {
            formattedObject[formattedKey] = object[key];
        }
    });

    return formattedObject;
}

function parseAuthentication(xml) {
    var xmlDoc = new xmldoc.XmlDocument(xml),
        json = xmlDoc.attr;

    xmlDoc.eachChild(function (child) {
        if (child.children.length > 0) {
            json[child.name] = parseAuthentication(child);
        } else {
            json[child.name] = child.val;
        }
    });

    return camelizeKeys(json);
}

function parseDirectories(xml) {
    var xmlDoc = new xmldoc.XmlDocument(xml),
        directories = xmlDoc.childrenNamed('Directory'),
        data = [];

    if (directories.length === 0) {
        directories = xmlDoc.childrenNamed('Video');
    }

    directories.forEach(function (directory) {
        data.push(directory.attr);
    });

    return data;
}

module.exports = {
    parseAuthentication: parseAuthentication,
    parseDirectories: parseDirectories
};