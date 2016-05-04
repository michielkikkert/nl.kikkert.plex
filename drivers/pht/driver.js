"use strict";

var url         = require('url');
var Q           = require('q');
var PlexAPI     = require("plex-api"); 
var config      = require('../../plex-config');
var constants   = require('../../const');

var supported = config.supportedPlayers;
var REMOTE_MODE = config.remoteMode;
var plexApp = Homey.app.api;
var identifierKey = "clientIdentifier";
var self = {};
var installedPlayers = [];

self.init = function(devices_data, callback){
	console.log("PHT Driver init");
    console.log("players installed", devices_data.length);
    console.log("players", devices_data);
    installedPlayers = devices_data;

    Homey.manager('flow').on('action.playitempht.selected.autocomplete', function( callback, args ){
        callback( null, plexApp.searchAutoComplete(args.query) ); 
    });

    Homey.manager('flow').on('action.playitempht', function( callback, args ){
        plexApi.player({mediaItem: args.selected.mediaItem, command: 'playItem', devices: [args.device]})
        callback( null, true );
    });

    callback();
}

self.pair = function( socket ) {

    console.log("pair");

    socket.on('list_devices', function( data, callback ){
        // Get available players from Plex.tv
        plexApp.getPlayers(function(result){
            
            var devices = [];

            result.Device.forEach(function(device) {
                
                var player = device.attributes;
                
                if (player.provides == "player" && player.name != "" && supported.indexOf(player.product) > -1) {
                    var deviceTemplate = {
                        name: "",
                        data: {},
                        capabilities: []
                    };
                    deviceTemplate.name = player.platform + " on " + player.name;
                    deviceTemplate.data = self.getPlayerTemplate(device);
                    deviceTemplate.data.id = player[identifierKey];
                    deviceTemplate.data.type = 'pht';
                    devices.push(deviceTemplate);
                }
            });
            console.log("devices", devices);
            callback( null, devices );
        }); 

    })

    socket.on('add_device', function(device, callback){
        console.log('add_device', device);
        self.addInstalledDevice(device);
    })

    socket.on('disconnect', function(data){
        console.log("User aborted pairing, or pairing is finished");
    })
}

self.deleted = function(device_data, callback){
    Homey.log('deviceDeleted', device_data);
    

    for (var x in installedPlayers) {

        // If device found
        if (installedPlayers[x].id == device_data.id) {

            // Remove it from devices array
            var index = installedPlayers.indexOf(installedPlayers[x]);
            if (index > -1) {
                installedPlayers.splice(index, 1);
            }
        }
    }

    console.log("still installed PHT players", installedPlayers);

    callback();
}

self.addInstalledDevice = function(device){

    console.log("addInstalledDevice", device);

    var currentDeviceId = device[identifierKey];
    var alreadyInstalled = false;

    installedPlayers.forEach(function(installed){
        if(installed[identifierKey] == currentDeviceId){
            alreadyInstalled = true;
        }
    });

    if(!alreadyInstalled){
        installedPlayers.push(device.data);
    }
}


self.getPlayerTemplate = function(device) {

    var hostname = device.publicAddress;
    var port = 3005;

    if (device.Connection) {
        var urlParts = url.parse(device.Connection[0].attributes.uri);
        hostname = urlParts.hostname;
        port = urlParts.port;
    }

    // OVERWRITE FOR REMOTE (VIRTUAL HOMEY) TESTING
    if (REMOTE_MODE) {
        hostname = device.attributes.publicAddress;
    }

    return {
        "name": device.attributes.name,
        "clientIdentifier": device.attributes.clientIdentifier,
        "token": device.attributes.token,
        "hostname": hostname,
        "port": port
    }
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

self.getHeaderOptions = function() {
    return {
        "identifier": constants.identifier,
        "product": constants.product,
        "version": constants.version,
        "deviceName": constants.deviceName,
        "platform": constants.platform
    };
}

self.getInstalledPlayers = function(){
    return installedPlayers;
};

self.updateInstalledPlayers = function(){

    var deferred = Q.defer();

    plexApp.getPlayers(function(result){

        if(result){
            result.Device.forEach(function(device) {

                var updatedPlayer = self.getPlayerTemplate(device);

                installedPlayers.forEach(function(player){
                    if(player.id === updatedPlayer[identifierKey]){
                        player = updatedPlayer;
                    }
                })    
            });

            deferred.resolve(installedPlayers);

        } else {

            deferred.reject(false);
        }

    }); 

    return deferred.promise;

}

self.isPlayerAvailable = function(plexPlayer){

    Homey.log("isPlayerAvailable", plexPlayer);

     var deferred = Q.defer();

     if (plexPlayer) {

        console.log("Connecting player: ", plexPlayer);

        plexPlayer.query("/player/playback").then(function(result) {
            
            Homey.log("plexPlayer query success", result);

            return deferred.resolve(true);

        }, function(err) {

            Homey.log("plexPlayer query fail", err);

            return deferred.reject(false);
        
        });

    } else {

        deferred.reject(false);

    }

     return deferred.promise;

}

self.process = function(options, callback, stop){

    console.log("DRIVER PROCESS", options);

    var mediaItem = options.mediaItem || null;
    var command = options.command || null;

    if(!typeof callback == 'function'){
        callback = function(){};
    }
    var playerConfig = null;
    var plexPlayer = null;

    //Determine player:
    if(installedPlayers.length == 0){
        callback({error: true, "message": "No players installed, please go to devices and install a player"});
        return;
    }

    if(options.devices.length > 0){
        playerConfig = options.devices[0];
    }

    if(!playerConfig){
        if(installedPlayers.length > 0){
            playerConfig = installedPlayers[0];
        } else { // This should never trigger. I now select the first installed player if muliple devices are found, but no device was found in speech. I might make this configurable behaviour.
            callback({error: true, "message": "Multiple players installed, not sure which one you need"});
            return;
        }
    }

    if(!playerConfig){
        callback({error: true, "message": "An unknown error occured"});
        return;
    }

    if(playerConfig){

        plexPlayer = new PlexAPI(self.getApiConfig(playerConfig));

        Homey.log("We have playerConfig and a plexPlayer object: ", plexPlayer);

        // Check if player is available:
        self.isPlayerAvailable(plexPlayer).then(

            function(){ // Available!

                var controls = new self.controls(plexPlayer);

                if(mediaItem && command == 'playItem'){
                    console.log('Play Item', mediaItem);
                    controls.play(mediaItem);
                    // callback(error: false, message: "Enjoy watching " + mediaItem)
                    return;
                }

                if(command){
                    if(typeof controls[command] == 'function'){
                        controls[command]();
                        return;    
                    } else {
                        callback({error: true, "message" : "command " + command + " not implemented for this player"});
                        return;
                    }
                    
                }

            },

            function(){ // Not available

                Homey.log("Player doesn't seem to be available");

                // The player is not available, possible reasons:
                // 1) The player is not running
                // 2) The IP of the player has changed
                // 3) The network is unreachable
                // We can really only attempt the get the latest Plex.tv player details and retry once..

                if(!stop){

                    callback({error: true, "message": "Could not connect to player, trying to update player details....."});

                    self.updateInstalledPlayers().then(
                        
                        function(){ // re-try
                            self.process(options, callback, true);
                        },

                        function(){
                            callback({error: true, "message": "Unable to update your players"});
                        }
                    )

                } else {

                    callback({error: true, "message": "Sorry, is your player running?"});
                
                }

            }
        ) 
    }
}

self.controls = function(player) {

    var performer = function(action, item) {

        console.log("performer ", arguments);

        var prefix = "/player/playback/";
        var payload = action;
        var postfix = "";

        switch (action) {
            case 'play':

                if (item) {
                    postfix = "&machineIdentifier=" + item.machineIdentifier;
                    payload = "playMedia?key=" + item.key;
                }

                break;

            case 'setParameters':
                postfix = "?" + item;
                break;

            case 'toggleOSD':
                prefix = "/player/navigation/";
                break;

        }

        var perform = prefix + payload + postfix;

        player.perform(perform).then(function(result) {
            console.info(action)
            Homey.manager('speech-output').say('Enjoy watching ' + item.title);
        }, function(err) {
            console.log(err);
            Homey.manager('speech-output').say(err);
        });
    }

    return {
        play: function(item) {
            performer('play', item);
        },
        pause: function() {
            performer('pause');
        },
        stop: function() {
            performer('stop');
        },
        forward: function() {
            performer('stepForward');
        },
        setVolume: function(volume) {
            performer('setParameters', 'volume=' + volume);
        },
        toggleOSD: function() {
            performer('toggleOSD');
        }
    }
}

self.api = { // Api used to access driver methods from App.

    getInstalledPlayers: self.getInstalledPlayers,
    process: self.process
}

module.exports.pair = self.pair;
module.exports.capabilities = {};
module.exports.init = self.init;
module.exports.deleted = self.deleted;
module.exports.api = self.api;

