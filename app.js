"use strict";

var Q = require('q');
var PlexAPI = require("plex-api");
var PlexAuth = require('plex-api-credentials');
var lunr = require('lunr');
var url = require('url');
var constants = require('./const');
var mediaTypes = require('./mediaTypes');
var plexConfig = require('./plex-config'); 
var plexTv = null;
var plexServer = null;
var plexPlayer = null;
var plexHasToken = false;
var plexTokens = {};
var indexers = {};
var mediaTriggerIds = [];
var serverTriggerIds = [];
var speechTriggers = [];
var MININDEXSCORE = 0.4;
var machineId = null;
var activeProfile = 1;
var pinTries = 0;
var cpuwarns = 0;
var logs = [];

var mediaCache = {
    updated: null,
    items: [],
    ondeck: [],
    recent: []
};

var defaultPlexSettings = {
    "hasSetup": false,
    "plexTv": {
        "username": null,
        "password": null,
        "token": null,
        "hostname": constants.plexTvHostname,
        "port": constants.plexTvPort
    },
    "servers": [],
    "selected": {
        "server": {
            "hostname": null
        }
    },
    "meta" : {
        "media" : null,
        "latestmovies" :[],
        "latestseries" :[],
    }
}

var settings = null;
var updating = false;
var autoUpdateTimer = null;
var reset = false;

var REMOTE_MODE = plexConfig.remoteMode;

var store = function(plex){
    Homey.manager('settings').set('plex', plex);
    Homey.manager('api').realtime('settings_update', plex);
}

var self = {};

var realtime = self.realtime = function(l){
    logs.push(arguments);

    if(logs.length > 100){
        logs.shift();
    }

    Homey.manager('api').realtime('console_log', arguments);
}

Homey.on('cpuwarn', function(warning){
    console.log("CPU WARNING", warning);
    cpuwarns = warning.count;
    realtime("-------- CPU WARNING -------- ", warning.count);
})

// console.log = function(l){
//     logs.push(l);    
//     if(logs.length > 100){
//         logs.shift();
//     }
//     Homey.manager('api').realtime('console_log', l);
//     process.stdout.write(l + '\n');
// }

self.init = function() {

    if(reset){
        reset = false;
        self.resetSettings();
    }

    clearTimeout(autoUpdateTimer);

    Homey.manager('speech-input').on('speech', self.processConversation);

    if(!Homey.manager('settings').get('plex')){
       store(defaultPlexSettings);
    } 

    settings = Homey.manager('settings').get('plex');
    settings.meta = {
        media: {}
    }

    self.setPlexTv();

    if (!settings.selected.server.hostname || !settings.plexTv.token) {
        settings.hasSetup = false;
    } else {
        settings.hasSetup = true;
        self.setPlexServer();
    }

    if (settings.hasSetup) {

        // is the plexserver available?
        self.isServerAvailable().then(function() {
            console.log("server is available");realtime("server is available");
            updating = true;
            // Prime the media cache.
            self.getMedia().then(function(media) {
                console.log('getMedia', media.items.length);realtime('getMedia', media.items.length);
                updating = false;
                console.log('warns:', cpuwarns);realtime('warns:', cpuwarns);
            });

            self.autoUpdate();

        }, function() {
            console.log("Plex server is NOT available");realtime("Plex server is NOT available");
        })

    } else {
        console.log("Plex app doesn't have any setup yet..Visit the settings page on your Homey!");
        realtime("Plex app doesn't have any setup yet..Visit the settings page on your Homey!");
    }
    
}

self.updateInstalledPlayers = function(callback){
    settings.installedPlayers = [];
    plexConfig.installedDrivers.forEach(function(driverKey){
        var curDevices = Homey.manager('drivers').getDriver(driverKey).api.getInstalledPlayers();
        curDevices.forEach(function(device){
            settings.installedPlayers.push(device);
        })
    })

    store(settings);

    callback(settings.installedPlayers);
}

self.getLogs = function(callback){
    
    if(callback){callback(logs)}
    return logs;
}

self.autoUpdate = function(){

    autoUpdateTimer = setTimeout(function(){
        updating = true;
        self.refreshMediaServer().then(function(){
            updating = false;
        }, function(){
            updating = false;
        });

        self.autoUpdate();

    }, plexConfig.autoUpdateTime);
}

self.searchAutoComplete = function(query){

    var items = [];

    if(query && query !=""){
        
        if(typeof indexers.autocomplete !="undefined"){
            var results = indexers.autocomplete.search(query);
            results.forEach(function(result){
                var mediaItem = self.keyToMediaItem(result.ref);
                var item = {}

                if(mediaItem.type == "movie"){
                    item.name = (mediaItem.secondaryTitle) ? mediaItem.title + " - " + mediaItem.secondaryTitle : mediaItem.title;
                }
                if(mediaItem.type == "episode"){
                    item.name = (mediaItem.verboseSearchTitle) ? mediaItem.verboseSearchTitle : mediaItem.title;
                }

                item.mediaItem = mediaItem;
                items.push(item);
            })
        }
        
    }

    return items;
}

self.getHeaderOptions = function() {
    return {
        "identifier": constants.identifier,
        "product": constants.product,
        "version": constants.version,
        "deviceName": constants.deviceName,
        "platform": constants.platform
    };
}

self.getApiConfig = function(selected) {

    return {
        "hostname": selected.hostname,
        "port": selected.port,
        "username": selected.username || "",
        "password": selected.password || "",
        "token": selected.token || "",
        "options": self.getHeaderOptions()
    };
}

self.setPlexServer = function() {
    if (settings.selected.server && settings.selected.server.hostname) {
        console.log("Setting plex server:", settings.selected.server);realtime("Setting plex server:", settings.selected.server);
        plexServer = new PlexAPI(self.getApiConfig(settings.selected.server));
        return true;
    } else {
        return false;
    }
}

self.setPlexTv = function() {
    plexTv = new PlexAPI(self.getApiConfig(settings.plexTv));
}

self.initPinProcess = function(callback){
    console.log('initPinProcess');
    self.getPlexPin(function(oPin){
       
        Homey.manager('api').realtime('pin_received', oPin.code);
        
        self.checkPlexPin(oPin,function(valid){
            if(valid){
                console.log('Valid Plex Token found');
                realtime('Valid Plex Token found');
            } else {
                console.log('No valid Plex Token found yet');
                realtime('No valid Plex Token found yet');
            }
        })
    })

    callback("started");
}

self.getPlexPin = function(callback) {
    console.log("getPlexPin()");
    plexTv.postQuery("/pins.xml").then(function(result) {
        callback(result.pin);
    })
}

self.checkPlexPin = function(oPin, callback) {

    console.log("checkPlexPin");
    var pinId = oPin.id[0]._;
    pinTries++;

    Homey.manager('api').realtime('pin_check', { 'tries': pinTries});

    plexTv.query("/pins/" + pinId + ".xml").then(function(result) {

        var valid = false;
        var token = result.pin.auth_token[0];

        if (token && typeof token == 'string' && token !== '') {
            // We have a token! Now let's check if it belongs to the initial ID

            console.log("TOKEN FOUND", token);

            if (result.pin.id[0]._ == pinId) {
                self.setPlexTvToken(token);
                //Re-init plexTv API
                self.setPlexTv();
                valid = true;
                pinTries = 0;
                console.log("Found valid plex.tv token", token);
                realtime("Found valid plex.tv token", token);
                self.getPlexServers(function(servers){
                    Homey.manager('api').realtime('servers_updated', { 'servers': servers});
                })
                Homey.manager('api').realtime('pin_process_success', true);
            }

        } else {
            
            console.log("TOKEN NOT FOUND", pinTries);
            if(pinTries < plexConfig.maxPinTries){
                setTimeout(function(){self.checkPlexPin(oPin, callback);}, plexConfig.pinTimeOut)
            } else {
                console.log("max pin tries reached without result");
                Homey.manager('api').realtime('pin_process_success', false);
            }
        }

        callback(valid);
    })
}

self.setPlexTvToken = function(token) {
    if (token && token != "") {
        settings.plexTv.token = token;
        store(settings);
    }
}

self.storeServers = function(servers) {

    // console.log("storeServers begin");
    // console.log(servers);
    // console.log(settings.servers);
    // console.log("storeServers end");

    var oExisting = {};
    
    var tempExistingServers = function(){
        
        settings.servers.forEach(function(existingServer){
            oExisting[existingServer.machineIdentifier] = existingServer;
            existingServer.connections.forEach(function(existingConnection){
                oExisting[existingServer.machineIdentifier + "|" + existingConnection.address + "|" + existingConnection.port + "|" + existingConnection.scheme] = existingConnection;
            })
        })
    }

    tempExistingServers();

    servers.forEach(function(server){
        if(typeof oExisting[server.machineIdentifier] == "undefined"){
            settings.servers.push(server);
        } else { // existing server, check connections
            server.connections.forEach(function(serverConnection){
                if(typeof oExisting[server.machineIdentifier + "|" + serverConnection.address + "|" + serverConnection.port + "|" + serverConnection.scheme] == "undefined"){
                    server.connections.push(serverConnection);
                }
            })
        }
    })

    settings.servers = servers;
    store(settings);

    // // First unregister media triggers
    // Homey.manager('speech-input').removeTrigger(serverTriggerIds, function(err) {
    //     if (!err) {
    //         console.log("Unregistering server triggers done");
    //     } else {
    //         console.log(err);
    //     }


    //     for (var a = 0; a < serverObject.length; a++) {
    //         var currentServer = serverObject[a].attributes;
    //         var id = "server|" + a;
    //         var triggers = [];

    //         if (currentServer.owned == "1") {
    //             triggers.push('switch to own server');
    //         }

    //         triggers.push("switch to " + currentServer.name);

    //         var triggerObject = {
    //             "id": id,
    //             "importance": 0.6,
    //             "triggers": {
    //                 "en": triggers
    //             }
    //         }

    //         console.log(triggerObject);

    //         Homey.manager('speech-input').addTrigger(triggerObject, function(err, result) {
    //             // console.log('args', arguments);
    //             if (!err) {
    //                 console.log("Registering server trigger done");
    //                 serverTriggerIds.push(id);
    //             } else {
    //                 console.log(err);
    //             }
    //         });

    //     }

    // })

}

self.getSettings = function(key) {
    return settings;
}

self.resetSettings = function() {
    store(defaultPlexSettings);
    settings = null;
    self.init(false);
}

self.getPlexServers = function(callback) {
    
    plexTv.query("/pms/servers.xml").then(function(result) {
        var servers = self.makeServersArray(result.MediaContainer.Server);
        callback(servers);
        self.storeServers(servers);
    }, function() {
        console.log("Failed to get servers from Plex.tv");
    })
}

self.getPlexPlayers = function(callback) {  // Used by Driver

    plexTv.query("/devices.xml").then(function(result) {
        callback(result.MediaContainer);
        self.storePlayers(result.MediaContainer.Device);
    }, function() {
        console.log("Failed to get players from Plex.tv");
        realtime("Failed to get players from Plex.tv");
        callback(false);
    })
}

self.isServerAvailable = function(callback) {
    var deferred = Q.defer();

    if (self.setPlexServer()) {

        plexServer.query("/").then(function(result) {
            console.log("Media server found: " + result.friendlyName);
            realtime("Media server found: " + result.friendlyName);
            if (result.machineIdentifier != "") {
                console.log("Machine identifier found: " + result.machineIdentifier);
                realtime("Machine identifier found: " + result.machineIdentifier);
                self.machineId = result.machineIdentifier;
                Homey.manager('api').realtime('selected_server_available', true);
                if(callback){ callback(true) };
                deferred.resolve(true);
            }

        }, function(err) {
            console.log("Could not connect to Plex Media Server: " + err);
            realtime("Could not connect to Plex Media Server: " + err);
            if(settings.selected.server.hostname.indexOf(err) > -1){
                Homey.manager('api').realtime('selected_server_available', false);    
            }
            
            if(callback){ callback(false) };
            deferred.reject();
        });

    } else {
        deferred.reject("No plex servers available");
        if(callback){ callback(false) };
        Homey.manager('api').realtime('selected_server_available', false);
    }

    return deferred.promise;
}

self.getPlexToken = function(api, config) {

    var deferred = Q.defer();

    PlexAuth(config).authenticate(api, function(empty, token) {
        deferred.resolve({
            "server": config.hostname,
            "token": token
        });
    });

    return deferred.promise;

}

self.setSelectedDevice = function(args) {

    console.log("setSelectedDevice", args);
    realtime("setSelectedDevice", args);

    var device = args.device;

    if (args.type == "server") {
        settings.selected.server = self.getServerTemplate(device);
        self.updateMediaCache();
        if (settings.selected.server.hostname) {
            settings.hasSetup = true;
        } else {
            settings.hasSetup = false;
        }
    }

    store(settings);

    return true;

}

self.makeServersArray = function(servers){
    
    var aServers = [];
    var allowShared = plexConfig.allowSharedServers;

    servers.forEach(function(server){
        var curServer = {};
        
        curServer.name              = server.attributes.name;
        curServer.machineIdentifier = server.attributes.machineIdentifier;
        curServer.owned             = (server.attributes.owned == "1") ? true : false;
        curServer.accessToken       = server.attributes.accessToken;
        curServer.connections       = [];

        if(curServer.owned){
            server.attributes.localAddresses.split(',').forEach(function(localserver){
                curServer.connections.push({"address": localserver, "port": plexConfig.defaultPort, "scheme": server.attributes.scheme, "local": true})
            });
        } else {
            curServer.sourceTitle = server.attributes.sourceTitle || "";
            curServer.ownerId = server.attributes.ownerId || "";

        }

        curServer.connections.push({"address": server.attributes.address, "port": server.attributes.port, "scheme": server.attributes.scheme, "local": false});

        aServers.push(curServer);
    })

    return aServers;

}

self.getServerTemplate = function(server) {

    return {
        "name": server.name,
        "machineIdentifier": server.machineIdentifier,
        "token": server.accessToken || null,
        "hostname": server.address,
        "port": server.port,
        "owned": server.owned,
        "local": server.local
    }
}

self.refreshMediaServer = function() {

    var deferred = Q.defer();


    plexServer.query("/library/sections/all/refresh").then(function(result) {

        console.log("Fired PMS update request");
        realtime("Fired PMS update request");

    }, function(err) {

        console.log(err);

    });

    setTimeout(function() {

        self.updateMediaCache().then(function(result) {
            deferred.resolve(result.media);
        });

    }, 15000);

    return deferred.promise;

}

self.updateMediaCache = function() {

    var outerPromise = Q.defer();
    var itemPromises = [];
    Homey.manager('api').realtime('media_update', true);

    // Empty mediaCache:
    mediaCache.items.length = 0;
    mediaCache.ondeck.length = 0;
    mediaCache.recent.length = 0;

    // Clear indexers:
    indexers = {};

    //Clear speechTriggers
    speechTriggers.length = 0;

    // Make sure we have the most recent media server
    self.setPlexServer();

    console.log("Updating media cache.........");
    realtime("Updating media cache.........");

    self.unRegisterMediaTriggers(function(err) {


        if (err) {
            console.log("unRegisterMediaTriggers ERROR", err);
        }

        // clear mediaTriggerIds
        mediaTriggerIds.length = 0;

        // Loop through supported media types
        plexConfig.supportedMediaTypes.forEach(function(type) {
            var currentPromise = self.cacheMediaByType(type);
            itemPromises.push(currentPromise);
        })

        // Process On Deck
        var ondeckPromise = self.cacheOndeck();
        itemPromises.push(ondeckPromise);


        // Process Recently added
        var recentlyPromise = self.cacheRecent();
        itemPromises.push(recentlyPromise);


        Q.allSettled(itemPromises).then(
            function(result) {
                console.log("Media Cache Updated");
                realtime("Media Cache Updated");
                mediaCache.updated = +new Date();
                settings.meta.media.updated = mediaCache.updated;
                settings.meta.media.triggers = speechTriggers.length;
                settings.meta.media.latestmovies = mediaCache.recent.slice(0,5);
                store(settings);
                Homey.manager('speech-input').addTrigger(speechTriggers, function(err, result) {
                    if (!err) {
                        console.log("Registering "+ speechTriggers.length +" media triggers done");
                        realtime("Registering "+ speechTriggers.length +" media triggers done");
                        console.log("Plex ready for commands..");
                        realtime("Plex ready for commands..");
                        Homey.manager('api').realtime('media_update', false);

                        outerPromise.resolve({
                            media: mediaCache,
                            fromcache: true
                        });

                    } else {
                        console.log(err);
                    }
                });
            },
            function(err) {
                console.log(err);
                outerPromise.reject(err);
            }
        );


    });


    return outerPromise.promise;

}

self.cacheMediaByType = function(type) {


        var deferred = Q.defer();
        settings.meta.media[type] = 0;
        // Check if type is correct
        if (typeof mediaTypes[type] == 'undefined') {
            console.log("Unknown media type: " + type);
            return deferred.reject();
        }

        plexServer.query("/library/all?type=" + mediaTypes[type]).then(function(result) {
            console.log("Found " + result._children.length + " media items of type: " + type);
            realtime("Found " + result._children.length + " media items of type: " + type);
            console.log("Adding " + type + " to cache.......");
            realtime("Adding " + type + " to cache.......");
            settings.meta.media[type] = result._children.length;


            for(var i =0; i < result._children.length; i++){
                var mediaItem = result._children[i];
                if (mediaItem._elementType == 'Video') {
                    var cacheItem = self.createMediaCacheItem(mediaItem);
                    mediaCache.items.push(cacheItem);

                    self.addToIndexer(type, cacheItem);

                    if (typeof mediaItem.viewCount == 'undefined') {
                        self.addToIndexer('neverwatched', cacheItem);
                    }

                    self.registerMediaTrigger(cacheItem);
                }
            }

            // result._children.forEach(function(mediaItem) {
            //     if (mediaItem._elementType == 'Video') {
            //         var cacheItem = self.createMediaCacheItem(mediaItem);
            //         mediaCache.items.push(cacheItem);

            //         self.addToIndexer(type, cacheItem);

            //         if (typeof mediaItem.viewCount == 'undefined') {
            //             self.addToIndexer('neverwatched', cacheItem);
            //         }

            //         self.registerMediaTrigger(cacheItem);
            //     }
            // });

            return deferred.resolve();

        }, function(err) {
            console.log(err);
            return deferred.reject({});
        });

        return deferred.promise;
    },

    self.cacheOndeck = function() {

        var deferred = Q.defer();
        var type = 'ondeck';
        settings.meta.media[type] = 0;

        plexServer.query("/library/onDeck").then(function(result) {
            console.log("Found " + result._children.length + " On Deck items");
            realtime("Found " + result._children.length + " On Deck items");
            console.log("Adding ondeck items to cache.......");
            realtime("Adding ondeck items to cache.......");
            settings.meta.media[type] = result._children.length;
            result._children.forEach(function(mediaItem) {
                if (mediaItem._elementType == 'Video') {
                    var cacheItem = self.createMediaCacheItem(mediaItem);
                    mediaCache.ondeck.push(cacheItem);
                    self.addToIndexer(type, cacheItem);
                }
            });
            return deferred.resolve();

        }, function(err) {
            console.log(err);
            return deferred.reject({});
        });

        return deferred.promise;
    },

    self.cacheRecent = function() {

        var deferred = Q.defer();
        var type = 'recent';
        settings.meta.media[type] = 0;

        plexServer.query("/library/recentlyAdded").then(function(result) {
            console.log("Found " + result._children.length + " Recent items");
            realtime("Found " + result._children.length + " Recent items");
            console.log("Adding recent items to cache.......");
            realtime("Adding recent items to cache.......");
            settings.meta.media[type] = result._children.length;
            result._children.forEach(function(mediaItem) {
                if (mediaItem._elementType == 'Video') {
                    var cacheItem = self.createMediaCacheItem(mediaItem);
                    mediaCache.recent.push(cacheItem);
                    self.addToIndexer(type, cacheItem);
                }
            });
            return deferred.resolve();

        }, function(err) {
            console.log(err);
            return deferred.reject({});
        });

        return deferred.promise;
    }

self.addToIndexer = function(indexType, item) {

    // console.log("addToIndexer", item.key);

    if (typeof indexers[indexType] === 'undefined') {
        indexers[indexType] = new lunr(function() {
            this.field('title', {
                boost: 10
            }); // Title is most important
            this.field('episodeTitle', {
                boost: 5
            });
            this.field('episodeIndex');
            this.field('compoundEpisodeIndex', {
                boost: 3
            });
            this.field('verboseSearchTitle', {boost: 10});
            this.field('season');
            this.field('key');
            this.ref('key'); // index ID is the PMS play key or the path within PMS
        });
    }
    indexers[indexType].add(item);

    if(typeof indexers.autocomplete === 'undefined'){
        indexers.autocomplete = new lunr(function() {
            this.field('title', {
                boost: 10
            }); // Title is most important
            this.field('episodeTitle', {
                boost: 5
            });
            this.field('episodeIndex');
            this.field('compoundEpisodeIndex', {
                boost: 3
            });
            this.field('verboseSearchTitle', {boost: 10});
            this.field('season');
            this.field('key');
            this.ref('key'); // index ID is the PMS play key or the path within PMS
        });
    }
    indexers.autocomplete.add(item);

}

self.registerMediaTrigger = function(mediaItem) {

    var id = "media|" + mediaItem.type + "|" + mediaItem.key;

    if (mediaItem.episodeTitle.toLowerCase().indexOf('episode') > -1) {
        mediaItem.episodeTitle = "";
    }

    if(mediaItem.episodeTitle){
        mediaItem.episodeTitle = mediaItem.episodeTitle.replace("(", "");
        mediaItem.episodeTitle = mediaItem.episodeTitle.replace(")", "");
        mediaItem.episodeTitle = mediaItem.episodeTitle.replace("&", "and");
    }

    if(mediaItem.title){
        mediaItem.title = mediaItem.title.replace("(", "");
        mediaItem.title = mediaItem.title.replace(")", "");
        mediaItem.title = mediaItem.title.replace("&", "and");
        mediaItem.title = mediaItem.title.replace("III", "3");
        mediaItem.title = mediaItem.title.replace("II", "2");
        mediaItem.title = mediaItem.title.replace(" – ", " ");
        mediaItem.title = mediaItem.title.replace("–", " ");
    }

    if(mediaItem.secondaryTitle){
        mediaItem.secondaryTitle = mediaItem.secondaryTitle.replace("(", "");
        mediaItem.secondaryTitle = mediaItem.secondaryTitle.replace(")", "");
        mediaItem.secondaryTitle = mediaItem.secondaryTitle.replace("&", "and");
        mediaItem.secondaryTitle = mediaItem.secondaryTitle.replace("III", "3");
        mediaItem.secondaryTitle = mediaItem.secondaryTitle.replace("II", "2");
        mediaItem.secondaryTitle = mediaItem.secondaryTitle.replace(" – ", " ");
        mediaItem.secondaryTitle = mediaItem.secondaryTitle.replace("–", " ");
    }


    var triggers = [];

    if (mediaItem.type == 'episode') {
        triggers.push(mediaItem.title + " " + mediaItem.season + " " + mediaItem.episodeIndex);
    }

    if (mediaItem.episodeTitle) {
        triggers.push(mediaItem.title + " " + mediaItem.episodeTitle);
    }

    if (mediaItem.title) {
        triggers.push(mediaItem.title);
    }

    if (mediaItem.primaryTitle && (mediaItem.title != mediaItem.primaryTitle)) {
        triggers.push(mediaItem.primaryTitle);
    }

    if (mediaItem.secondaryTitle) {
        triggers.push(mediaItem.secondaryTitle);
    }

    if (mediaItem.titleSort) {
        triggers.push(mediaItem.titleSort);
    }


    var triggerObject = {
        "id": id,
        "importance": 0.7,
        "triggers": {
            "en": triggers
        }
    }

    speechTriggers.push(triggerObject);
    mediaTriggerIds.push(id);

}

self.unRegisterMediaTriggers = function(callback) {

    Homey.manager('speech-input').removeTrigger(mediaTriggerIds, function(err) {
        if (!err) {
            console.log("Unregistering media triggers done");
        } else {
            console.log(err);
        }

        if (typeof callback == 'function') {
            callback();
        }
    })

}


self.createMediaCacheItem = function(mediaChild) {

    console.log("createMediaCacheItem", mediaChild.type, mediaChild.key); // DO NOT REMOVE THIS CONSOLE LINE!

    var cacheTemplate = {
        "machineIdentifier": settings.selected.server.machineIdentifier,
        "type": mediaChild.type,
        "title": (mediaChild.type == 'movie') ? mediaChild.title : mediaChild.grandparentTitle,
        "key": mediaChild.key,
        "file": mediaChild._children[0]._children[0].key,
        "container": mediaChild._children[0]._children[0].container,
        "episodeTitle": (mediaChild.type == 'episode') ? mediaChild.title : "",
        "episodeIndex": (mediaChild.type == 'episode') ? "episode " + mediaChild.index : "",
        "season": (mediaChild.type == 'episode') ? "season " + mediaChild.parentIndex : "",
        "primaryTitle": false,
        "secondaryTitle": false,
        "titleSort": (mediaChild.titleSort) ? mediaChild.titleSort : false,
        "score": 0,
        "compoundEpisodeIndex": 0,
        "viewOffset": mediaChild.viewOffset || null,
        "verboseSearchTitle" : false
    };

    if (cacheTemplate.title.indexOf(':') > 1) {
        cacheTemplate.primaryTitle = cacheTemplate.title.split(':')[0].trim();
        cacheTemplate.secondaryTitle = cacheTemplate.title.split(':')[1].trim();
        cacheTemplate.title = cacheTemplate.title.replace(": ", " ");
    } else {
        cacheTemplate.primaryTitle = cacheTemplate.title;
    }


    if (cacheTemplate.type == 'episode') {
        cacheTemplate.compoundEpisodeIndex = (mediaChild.parentIndex * 1000) + parseInt(mediaChild.index);
        cacheTemplate.verboseSearchTitle = cacheTemplate.title + " " + cacheTemplate.season + " " + cacheTemplate.episodeIndex;
    }

    return cacheTemplate;
}

self.getMedia = function() {

    var deferred = Q.defer();

    console.log("getMedia()");
    console.log("cache size: " + mediaCache.items.length);

    if (mediaCache.items.length > 0) {
        console.log("Media from cache");
        deferred.resolve(mediaCache);
    } else {
        self.updateMediaCache().then(function(result) {
            console.log("Media from updated cache");
            deferred.resolve(result.media);
        });
    }

    return deferred.promise;
}

self.getSessions = function() {

    console.log("getSessions..");

    var deferred = Q.defer();

    if(self.setPlexServer()){
        plexServer.query("/status/sessions").then(function(sessions) {
            // console.log(sessions);
            var response = [];

            sessions._children.forEach(function(session) {
                response.push(session);
            });

            deferred.resolve(response);
        
        }, function(err){

            deferred.reject(err);

        });
    }

    return deferred.promise;
}

self.processConversation = function(speechObject) {

    if(!settings.hasSetup){
        Homey.manager('speech-output').say("You need to register a Plex Media Server first. Go to the settings page");
        return;
    }

    if(mediaCache.items.length == 0){
        Homey.manager('speech-output').say("I couldn't find any media items");
        return;
    }

    console.log('speechObject', speechObject);
    realtime('speechObject', speechObject);

    // parse the speech object 
    var speechResults = {
        commands: [],
        types: [],
        media: [],
        server: [],
        zones: speechObject.zones,
        transcript: speechObject.transcript,
        devices: speechObject.devices
    };

    var zone = (speechResults.zones.length > 0) ? speechResults.zones[0] : 'default'; // Not used yet.
    var device = (speechResults.devices.length > 0) ? speechResults.devices[0] : null; 

    if(speechResults.devices.length == 0){

        // Dermine the devices that are installed accross the different drivers;
        var devices = [];

        plexConfig.installedDrivers.forEach(function(driverKey){
            var curDevices = Homey.manager('drivers').getDriver(driverKey).api.getInstalledPlayers();
            curDevices.forEach(function(device){
                devices.push(device);
            })
        })

        if(devices.length == 0){
            Homey.manager('speech-output').say("I couldn't find any installed players. Go to the devices page to install one");
            return;
        }

        // Add the first device found. This might have to be changed at a later point, maybe by setting a default device option in driver settings.
        speechResults.devices.push(devices[0]);

    }

    console.log("speechResults", speechResults);


    // Go through the triggers and find corresponding items:
    speechObject.triggers.forEach(function(trigger) {

        var elems = trigger.id.split("|");

        if (elems.length > 1) {
            if (elems[0] == 'command') {
                speechResults.commands.push(elems[1]);
            }

            if (elems[0] == 'type') {
                speechResults.types.push(elems[1])
            }

            if (elems[0] == 'media') {
                speechResults.media.push({
                    "match": trigger.text,
                    "type": elems[1],
                    "ref": elems[2]
                });
            }

            if (elems[0] == 'server') {
                speechResults.server.push(elems[1]);
            }
        }
    });

    // Server selection by Speech disabled for now. 
    // Shared server support can be build in, however, some features like active sessions won't work with remote servers so need to do some more tests for that.
    
    // if (speechResults.server.length > 0) {   
    //     var selectedServerObject = settings.servers[parseInt(speechResults.server)];
    //     self.setSelectedDevice({
    //         "type": "server",
    //         "device": selectedServerObject
    //     });
    //     Homey.manager('speech-output').say("Media server set to " + selectedServerObject.attributes.name);
    //     return;
    // }

    if (speechResults.commands.length > 0) {

        // Test for commands:
        if (speechResults.commands.indexOf('pause') > -1) {
           self.player({command: "pause", devices: speechResults.devices});
            return true;
        }
        if (speechResults.commands.indexOf('continue') > -1) {
            self.player({command: "play", devices: speechResults.devices});
            return true;
        }
        if (speechResults.commands.indexOf('stop') > -1) {
            self.player({command: "stop", devices: speechResults.devices});
            return true;
        }
        if (speechResults.commands.indexOf('refresh') > -1) {
            self.updateMediaCache();
            return true;
        }

        if (speechResults.commands.indexOf('currentlyplaying') > -1) {
            
            console.log("currentlyplaying", speechResults);

            // TODO:
            // Move these driver specific tests to the drivers while exposing the logic in app.js (API)

            if(speechResults.devices[0].type == 'pht'){
                self.getSessions().then(function(current) {

                    console.log("Active playing session found", current);

                    var friendly = "";
                    var mediaItem = self.createMediaCacheItem(current[0]);

                    if (mediaItem.type == 'episode') {

                        friendly = "You are watching an episode of " + mediaItem.title + " named " + mediaItem.episodeTitle + ", " + mediaItem.season + ", " + mediaItem.episodeIndex;

                    } else {

                        friendly = "You are watching " + mediaItem.title;

                    }

                    Homey.manager('speech-output').say(friendly);

                    return;
                });
            } 

            if(speechResults.devices[0].type == 'chromecast'){

                console.log("chromecast last session");

                var friendly = "";
                var mediaItem = Homey.manager('drivers').getDriver('chromecast').api.getLastSession();

                console.log("getLastSession", mediaItem);

                if(mediaItem && mediaItem.title){
                    if (mediaItem.type == 'episode') {

                        friendly = "You are watching an episode of " + mediaItem.title + " named " + mediaItem.episodeTitle + ", " + mediaItem.season + ", " + mediaItem.episodeIndex;

                    } else {

                        friendly = "You are watching " + mediaItem.title;

                    }

                    Homey.manager('speech-output').say(friendly);
                    return;
                }

            }

            return true;
        }

        // Main "I want to watch something" Logic


        if (speechResults.commands.indexOf('watch') > -1) {

            // Okay, user wants to watch something.

            var speechMedia = speechResults.media;
            var speechMediaLength = speechMedia.length;

            // First handle special commands:
            if (speechResults.commands.indexOf('watchnextepisode') > -1) {

                self.getSessions().then(function(current) {


                    // console.log("Active playing session found", current);

                    if (current.length == 0) {
                        console.log("No active player session found");
                        Homey.manager('speech-output').say("No active watch sessions found. I'm not sure what you want to watch. Please start over");
                        return;
                    }

                    var mediaItem = self.createMediaCacheItem(current[0]);


                    console.log("mediaItem", mediaItem);

                    if (mediaItem.type == 'episode') {

                        var currentEppie = mediaItem.compoundEpisodeIndex;
                        var currentTitle = mediaItem.title;

                        //TODO: handle end of season scenario 

                        var nextCompoundIndex = parseInt(currentEppie) + 1;

                        var results = indexers['episode'].search(currentTitle + " " + nextCompoundIndex);

                        if (results.length > 0) {
                            self.player({mediaItem: self.keyToMediaItem(results[0].ref), command: 'playItem', devices: speechResults.devices});
                            return true;
                        } else {
                            Homey.manager('speech-output').say("Sorry, I couldn't find the next episode for " + currentTitle);
                            return;
                        }

                    }

                })
            }

            if (speechResults.commands.indexOf('watchpreviousepisode') > -1) {

                console.log("COMMAND: watchpreviousepisode triggered!");

                self.getSessions().then(function(current) {


                    console.log("Active playing session found", current);

                    if (current.length == 0) {
                        console.log("No active player session found");
                        Homey.manager('speech-output').say("No active watch sessions found. I'm not sure what you want to watch. Please start over");
                        return;
                    }

                    var mediaItem = self.createMediaCacheItem(current[0]);


                    console.log("mediaItem", mediaItem);

                    if (mediaItem.type == 'episode') {

                        var currentEppie = mediaItem.compoundEpisodeIndex;
                        var currentTitle = mediaItem.title;

                        //TODO: handle begin of season scenario 

                        var prevCompoundIndex = parseInt(currentEppie) - 1;

                        var results = indexers['episode'].search(currentTitle + " " + prevCompoundIndex);

                        if (results.length > 0) {
                            self.player({mediaItem: self.keyToMediaItem(results[0].ref), command: 'playItem', devices: speechResults.devices});
                            return true;
                        } else {
                            Homey.manager('speech-output').say("Sorry, I couldn't find the next episode for " + currentTitle);
                            return;
                        }

                    }

                }, function(err){
                    console.log("ERROR: watchpreviousepisode", err);
                })
            }


            // First check the specific command cases
            if (speechMediaLength == 0) {
                if (speechResults.commands.indexOf('random') > -1 && speechResults.types.indexOf('movie') > -1) {

                    Homey.manager('speech-output').say("Playing random movie from your collection!");

                    // Get movies from cache
                    var tempMovies = self.filterMediaItemsBy('type', 'movie', mediaCache.items);
                    self.player({mediaItem: tempMovies[Math.floor(Math.random() * tempMovies.length)], command: 'playItem', devices: speechResults.devices});
                    return;
                }
            }

            // Find out if we have a media item match:

            if (speechMediaLength == 1) { // One result - easy peasy.
                var mediaItem = self.keyToMediaItem(speechMedia[0].ref);

                // There can be only one!
                console.log("Found single :" + mediaItem.type);
                console.log("Going to try to play: ", mediaItem.title);
                console.log("Waiting for player.......");

                self.player({mediaItem: mediaItem, command: 'playItem', devices: speechResults.devices});

                return;

            } else if (speechMediaLength > 1) { // Multiple results on speech match

                console.log("More than 1 result, namely: " + speechMediaLength);

                var longestItems = self.getLongestItemsInSpeechMedia(speechMedia);

                console.log("After filter for longest items", longestItems.length);

                if (longestItems.length == 1) {
                    
                    console.log("Found single longest item, assuming best match");
                    var mediaItem = self.keyToMediaItem(longestItems[0].ref);
                    self.player({mediaItem: mediaItem, command: 'playItem', devices: speechResults.devices});
                    return;

                } else {

                    // Convert found speech keys to actual media items:
                    var mediaItemSelection = self.indexToMediaArray(longestItems, mediaCache.items);

                    // console.log("mediaItemSelection", mediaItemSelection);

                    // Break up items into series and movies:
                    var seriesMedia = self.filterMediaItemsBy("type", "episode", mediaItemSelection)
                    var moviesMedia = self.filterMediaItemsBy("type", "movie", mediaItemSelection);
                    var lastType = speechResults.types[speechResults.types.length - 1] || null;
                    var remainingMedia = [];


                    // Check for possible single results (shortcut as if we do have a single result, we can immediately play without further processing):
                    if (lastType == 'movie' && moviesMedia.length == 1) {

                        console.log("Found speech type movie, with a single speech result -> playing!", moviesMedia[0]);
                        self.player({mediaItem: moviesMedia[0], command: 'playItem', devices: speechResults.devices});
                        return;

                    }

                    if (lastType == 'episode' && seriesMedia.length == 1) {
                        console.log("Found speech type series, with a single speech result -> playing!", seriesMedia[0]);
                        self.player({mediaItem: seriesMedia[0], command: 'playItem', devices: speechResults.devices});
                        return;
                    }

                    if (speechResults.commands.indexOf('random') > -1) {
                        if (lastType == 'episode') {
                            console.log("Playing random episode");
                            self.player({mediaItem: seriesMedia[Math.floor(Math.random() * seriesMedia.length)], command: 'playItem', devices: speechResults.devices});
                            return;
                        }

                        if (lastType == 'movie') {
                            console.log("Playing random movie");
                            self.player({mediaItem: moviesMedia[Math.floor(Math.random() * moviesMedia.length)], command: 'playItem', devices: speechResults.devices});
                            return;
                        }
                    }


                    // Do we need to ask the user for a type?
                    // Check if we only have one type left or if speech contained a type:

                    if (seriesMedia.length == 0 || moviesMedia.length == 0) {
                        remainingMedia = (seriesMedia.length > 0) ? seriesMedia : moviesMedia;
                        if (!lastType) {
                            lastType = (seriesMedia.length > 0) ? "episode" : "movie";
                        }
                    }

                    if (remainingMedia.length == 0 && !lastType) { // We have a mixed result, and no speech type. 

                        // Ask user for type
                        self.askQuestion("Would you like to watch a movie or a series?", ['movie', 'series']).then(function(result) {

                            console.log("Valid response from askQuestion", result);

                            if (result == 'abort') {
                                return;
                            }

                            if (result == 'movie') {
                                remainingMedia = moviesMedia;
                            } else if (result == 'series') {
                                remainingMedia = seriesMedia;
                            }

                            self.getSingleResult(remainingMedia, speechResults);
                            return;


                        }, function(err) {

                            console.log("Invalid response from askQuestion", err);
                            Homey.manager('speech-output').say("Sorry... I didn't understand " + err + ". Please try again.");

                        })

                    } else {

                        console.log("lastType", lastType);
                        // console.log("moviesMedia", moviesMedia);
                        // console.log("seriesMedia", seriesMedia);

                        if (lastType == 'movie') {
                            self.getSingleResult(moviesMedia, speechResults);
                        }

                        if (lastType == 'episode') {
                            self.getSingleResult(seriesMedia, speechResults);
                        }

                    }
                }
            }

            // No match in the media speech triggers or the type triggers. 
            // Speech might have misunderstood, the user might nog have asked for a media item yet, or the item asked for
            // doesn't exist in the Plex lib.

            if (speechMediaLength == 0 && speechResults.types.length == 0) {
                console.log("speech-output", "What would you like to watch?");

                // Pretty much unknown what the user wants. I have a 'watch' command, but no type (movie|episode) and no title.
                // We need to abort here.

                var unknownString = speechResults.transcript.trim();


                Homey.manager('speech-output').say("Sorry, I don't know what you mean with " + unknownString);
                console.log("SAY", "Sorry, I don't know what you mean with " + unknownString)
                return;
            }

            // Scenario: "I want to watch a movie|series|show"
            // So user wants to 'watch' something and a type has been recognised
            // No matching media found
            // TODO: ask for title of type

            // if (speechMediaLength == 0 && speechResults.types.length == 1) {
            //     console.log("speech-output", "What " + speechResults.types[0] + " would you like to watch?");
            //     Homey.manager('speech-output').say("What  " + speechResults.types[0] + " would you like to watch?"); // ask
            // }
        }

    }
}

self.getSingleResult = function(selection, speechResults) {
    // If we got here, we HAVE to get to a single result, otherwise we can only abort.
    // We are expecting a selection (1 to many), all of the same type (movie or series). Speech matching might already have yielded a single result.

    console.log("GOING TO getSingleResult() with number of items", selection.length);

    var zone = (speechResults.zones.length > 0) ? speechResults.zones[0] : 'default';
    
    var longSpeechMediaResults = self.getLongestItemsInSpeechMedia(speechResults.media);
    var speechMatch = longSpeechMediaResults[0].match;
    var numResults = selection.length;
    var titles = [];
    var secondaryTitles = [];

    // console.log("getSingleResult", selection);

    if (selection.length == 0) {
        console.log("Something is wrong, probably failed to register the speech triggers correctly");
        return;
    }

    if (selection.length == 1) { // Okay... that was easy... (it is a possible scenario)
        self.player({mediaItem: selection[0], command: 'playItem', devices: speechResults.devices});
        return;
    }

    var currentType = selection[0].type;
    // console.log("currentType", currentType);

    if (currentType == 'movie') {
        // Something like transformers, transformers dark of the moon and transformers revenge of the fallen

        // console.log("Found " + numResults + " movies, with the title " + speechMatch);

        if (numResults < 5) {
            titles = self.getMetaFromMedia("title", selection);
            // console.log(titles);
        }

        // fetch seconday titles for allowed speech result:
        secondaryTitles = self.getMetaFromMedia("secondaryTitle", selection);
        secondaryTitles.push(speechMatch);

        // console.log("secondaryTitles", secondaryTitles);

        var question = "I found " + numResults + " matching results for " + speechMatch + ". Which would you like to watch? ";
        question += secondaryTitles.join(",");
        question += "?";


        self.askQuestion(question, titles.concat(secondaryTitles)).then(function(result) {

            // console.log("MATCH", result);

            var selected = self.filterMediaItemsBy("title", result, selection);

            if (selected.length == 0) {
                selected = self.filterMediaItemsBy("secondaryTitle", result, selection);
            }

            console.log("selected", selected);
            self.player({mediaItem: selected[0], command: 'playItem', devices: speechResults.devices});
            return true;

        }, function(err) {

            console.log("FAIL:", err);
            Homey.manager('speech-output').say("Sorry, I couldn't find a match for " + result + ". Please start over");
            return false;

        })
    }

    if (currentType == 'episode') {

        console.log("Found " + numResults + " episodes, with the title " + speechMatch);

        // Did we maybe have another clue in the speech match commands?
        if (speechResults.commands.indexOf('latest') > -1) { // So user wants to watch the latest episode, but it was somehow not on deck?

            var newestEppie = self.getNewestEpisode(selection);

            // console.log("newestEppie", newestEppie);

            if (newestEppie) {
                Homey.manager('speech-output').say("Okay, playing the most recent episode of " + speechMatch);
                self.player({mediaItem: newestEppie, command: 'playItem', devices: speechResults.devices});
                return true;

            }

        }

        if (speechResults.commands.indexOf('first') > -1) { // So user wants to watch the latest episode, but it was somehow not on deck?

            var firstEppie = self.getLowestEpisode(selection);

            // console.log("firstEppie", firstEppie);

            if (firstEppie) {
                Homey.manager('speech-output').say("Okay, playing the oldest episode of " + speechMatch);
                self.player({mediaItem: firstEppie, command: 'playItem', devices: speechResults.devices});
                return true;
            }

        }

        if (speechResults.commands.indexOf('random') > -1) { // So user wants to watch the latest episode, but it was somehow not on deck?
            self.player({mediaItem: selection[Math.floor(Math.random() * selection.length)], command: 'playItem', devices: speechResults.devices});
            return;

        }

        var episodesOnDeck = [];

        // we have a selection of mediaItems here. Let's check any match the mediaItems in ondeck:
        episodesOnDeck = self.getMatchingItems(selection, mediaCache.ondeck);
        // console.log("episodesOnDeck", episodesOnDeck);

        if (episodesOnDeck.length == 1) { // Yeah! 1 result on deck. Let's play it.
            self.player({mediaItem: episodesOnDeck[0], command: 'playItem', devices: speechResults.devices});
            return true;
        }

        if (episodesOnDeck.length > 1) { // multiple episode results on Deck found, let's determine te one to play:

            var lowestEpisode = self.getLowestEpisode(episodesOnDeck);
            if (lowestEpisode) {
                self.player({mediaItem: lowestEpisode, command: 'playItem', devices: speechResults.devices});
                return true;
            }
        }

        // No match yet.. Let's check recently added:
        var episodesRecent = self.getMatchingItems(selection, mediaCache.recent);
        // console.log("episodesRecent", episodesRecent);

        if (episodesRecent.length == 1) { // Yeah! 1 result on deck. Let's play it.
            self.player({mediaItem: episodesRecent[0], command: 'playItem', devices: speechResults.devices});
            return true;
        }

        if (episodesRecent.length > 1) { // multiple episode results on Deck found, let's determine te one to play:

            var lowestEpisode = self.getLowestEpisode(episodesRecent);
            if (lowestEpisode) {
                self.player({mediaItem: lowestEpisode, command: 'playItem', devices: speechResults.devices});
                return true;
            }
        }


        // Okay, this is the last stop. We still haven't found what we're looking for (a single episode to play)
        // Let's put the indexers to work.
        console.log("LAST STOP: ", selection.length, "episodes left");

        // Let's check the indexer result for 'never watched'
        var neverWatchedItems = indexers['neverwatched'].search(speechMatch);

        if (neverWatchedItems.length > 0) {
            var neverWatchedMedia = self.indexToMediaArray(neverWatchedItems, selection);

            if (neverWatchedMedia.length == 1) {
                self.player({mediaItem: neverWatchedMedia[0], command: 'playItem', devices: speechResults.devices});
                return true;
            }

            if (neverWatchedMedia.length > 1) {
                var lowestNeverWatched = self.getLowestEpisode(neverWatchedMedia);

                if (lowestNeverWatched) {
                    self.player({mediaItem: lowestNeverWatched, command: 'playItem', devices: speechResults.devices});
                    return true;
                }
            }

        }

        // Okay, we are still not successful. We need to try to get a match by asking more information I guess..
        var question = "Sorry, I do not have enough information to find what you want to watch. Do you have any more information on what episode of " + speechMatch + " you want to watch?";

        self.askQuestion(question, false).then(function(result) {

            if (result.indexOf('no') > -1 || result.indexOf('first') > -1) { // Let's just play the first eppie
                console.log("no or first");
                var firstEppie = self.getLowestEpisode(selection);

                console.log("firstEppie", firstEppie);

                if (firstEppie) {
                    Homey.manager('speech-output').say("Okay, playing the oldest episode of " + speechMatch);
                    self.player({mediaItem: lowestNeverWatched, command: 'playItem', devices: speechResults.devices});
                    return true;
                }
            }

            if (result.indexOf('newest') > -1 || result.indexOf('latest') > -1) {
                console.log("latest or newest");

                var newestEppie = self.getNewestEpisode(selection);

                console.log("newestEppie", newestEppie);

                if (newestEppie) {
                    Homey.manager('speech-output').say("Okay, playing the most recent episode of " + speechMatch);
                    self.player({mediaItem:  newestEppie, command: 'playItem', devices: speechResults.devices});
                    return true;

                }
            }

            if (result.indexOf('random') > -1 || result.indexOf('any') > -1) {
                console.log("random or any");
                var randMedia = selection[Math.floor(Math.random() * selection.length)];
                console.log("randMedia", randMedia)
                Homey.manager('speech-output').say("Okay, playing a random episode of " + speechMatch);
                self.player({mediaItem:  randMedia, command: 'playItem', devices: speechResults.devices});
                return true;

            }

            // Let's try if we can get a good match from the indexer
            var concatSearchString = speechMatch + " " + result;
            var eppieConcatSearch = indexers['episode'].search(concatSearchString);

            if(eppieConcatSearch.length > 0){

                var bestEppieIndexResult = self.getBestResult(eppieConcatSearch);
                // console.log("bestEppieIndexResult", bestEppieIndexResult);

                var bestEppieMedia = self.keyToMediaItem(bestEppieIndexResult.ref);
                // console.log("bestEppieMedia", bestEppieMedia);


                if(bestEppieMedia){
                    self.player({mediaItem:  bestEppieMedia, command: 'playItem', devices: speechResults.devices});
                    return true;
                }

            }

            Homey.manager['speech-output'].say("I'm sorry master, I failed you. Please start over");


        }, function(err) {

            Homey.manager('speech-output').say("I'm sorry master, I failed you. Please start over");

        })


        return;

    }

    return false;


}

self.getMetaFromMedia = function(key, selection) {

    var meta = [];

    selection.forEach(function(item) {
        if (item[key]) {
            meta.push(item[key].toLowerCase())
        }
    })

    return meta;

}

self.getMatchingItems = function(selection, media) {

    var matches = [];
    var keys = [];

    selection.forEach(function(item) {
        keys.push(item.key);
    })

    media.forEach(function(item) {
        var keyIndexMatch = keys.indexOf(item.key);
        if (keyIndexMatch > -1) {
            matches.push(item);
        }
    });

    return matches;

}

self.askQuestion = function(question, allowedAnswers) {

    var deferred = Q.defer();

    console.log("askQuestion: ", question);

    Homey.manager('speech-input').ask(question, function(err, result) {
        if (err) {
            console.log("ASK ERROR", err);
            // Homey.error( err );
            return deferred.reject(err);
        }

        // Homey should do this (maybe it does by now..)
        result = result.trim().toLowerCase();
        
        console.log("You said:", result);

        if (allowedAnswers) {

            for (var a = 0; a < allowedAnswers.length; a++) {
                var allowedAnswer = allowedAnswers[a];

                console.log("allowedAnswer", allowedAnswer);
                console.log("indexOf", allowedAnswer.indexOf(result));

                if (allowedAnswer.indexOf(result) != -1) {
                    return deferred.resolve(allowedAnswer);
                }
            }

            return deferred.reject(result);

        } else {

            return deferred.resolve(result);

        }

    });

    return deferred.promise;
}

self.indexToMediaArray = function(index, selection) {
    var tempArray = [];
    var keys = [];

    index.forEach(function(indexItem) {
        keys.push(indexItem.ref);
    });

    selection.forEach(function(item) {
        var keyIndexMatch = keys.indexOf(item.key);
        if (keyIndexMatch > -1) {
            item.score = index[keyIndexMatch].score || 0;
            tempArray.push(item);
        }
    });

    return tempArray;
}

self.keyToMediaItem = function(key) {

    for (var a = 0; a < mediaCache.items.length; a++) {
        var curItem = mediaCache.items[a];
        if (curItem.key == key) {
            return curItem;
        }
    }
}

self.getLongestItemsInSpeechMedia = function(speechMedia) {

    if (speechMedia.length < 2) { // shouldn't happen, but just in case
        return speechMedia;
    }

    var longestItems = [];
    var controlLength = 0;

    for (var a = 0; a < speechMedia.length; a++) {

        if (speechMedia[a].match.length > controlLength) { // We found a larger item, reset the array and push
            longestItems.length = 0;
            longestItems.push(speechMedia[a]);
            controlLength = speechMedia[a].match.length;
        } else if (speechMedia[a].match.length == controlLength) {
            longestItems.push(speechMedia[a]);
        }

    }

    return longestItems;
}

self.getBestResult = function(selection) {

    var bestResult = selection[0] || null;

    for (var a = 0; a < selection.length; a++) {
        if (selection[a].score > bestResult.score) {
            bestResult = selection[a];
        }
    }

    return bestResult;
}

self.getLowestEpisode = function(episodes) {

    var lowestEpisode = episodes[0];

    for (var a = 0; a < episodes.length; a++) {

        var curEppiIndex = parseInt(episodes[a].compoundEpisodeIndex);
        var lowestIndex = parseInt(lowestEpisode.compoundEpisodeIndex);

        if (curEppiIndex < lowestIndex) {
            lowestEpisode = episodes[a];
        }
    }

    return lowestEpisode;
}

self.getNewestEpisode = function(episodes) {

    console.log("determine newest episode from selection of " + episodes.length);

    var newestEpisode = episodes[0];

    for (var a = 0; a < episodes.length; a++) {
        var curEppiIndex = parseInt(episodes[a].compoundEpisodeIndex);
        var newestIndex = parseInt(newestEpisode.compoundEpisodeIndex);

        if (curEppiIndex > newestIndex) {
            newestEpisode = episodes[a];
        }
    }

    return newestEpisode;
}

self.filterMediaItemsBy = function(key, value, selection) {

    var result = [];

    selection.forEach(function(item) {
        if (item[key] && value) {
            if (item[key].toLowerCase() == value.toLowerCase()) {
                result.push(item);
            }
        }
    });

    return result;
}

self.player = function(options){

    options.server = settings.selected.server;
    options.serverToken = settings.selected.server.token;
    var driverKey = options.devices[0].type;

    Homey.manager('drivers').getDriver(driverKey).api.process(options, function(response){
        if(response.message){
            Homey.manager('speech-output').say(response.message);
        }
    });

    if(options.command == "playItem" || options.command == "play"){
        Homey.manager('flow').trigger('media_start');
    }

    if(options.command == "stop" || options.command == "pause"){
        Homey.manager('flow').trigger('media_stop');
    }

}



self.api = {
    initPin: self.initPinProcess,
    getPin: self.getPlexPin,
    checkPin: self.checkPlexPin,
    getServers: self.getPlexServers,
    getPlayers: self.getPlexPlayers,
    updateInstalledPlayers: self.updateInstalledPlayers,
    getSettings: self.getSettings,
    resetSettings: self.resetSettings,
    setSelectedDevice: self.setSelectedDevice,
    getPlayerTemplate: self.getPlayerTemplate,
    searchAutoComplete: self.searchAutoComplete,
    player: self.player,
    getLogs: self.getLogs,
    isServerAvailable: self.isServerAvailable,
    realtime: self.realtime
}

module.exports = {
    init: self.init,
    api: self.api
};