"use strict";

var Q 				= require('q');
var PlexAPI 		= require("plex-api");
var PlexAuth		= require('plex-api-credentials');
var lunr			= require('lunr');
var merge			= require('object-merge');
var url				= require('url');
var constants 		= require('./const');
var mediaTypes		= require('./mediaTypes');
var plexConfig 		= require('./plex-config');	// Use Homey.manager.get eventually

var plexTv 			= null;
var plexServer 		= null;
var plexPlayer 		= null;
var plexHasToken	= false;
var plexTokens		= {};
var indexers 		= {};
var mediaTriggerIds	= [];
var serverTriggerIds= [];
var speechTriggers 	= [];
var MININDEXSCORE 	= 0.4;

var machineId 		= null;
var activeProfile 	= 1;
var mediaCache 		= {
						updated : null,
						items: [],
						ondeck : [],
						recent: [] 
					  };
var defaultPlexSettings = {

	"hasSetup"		: null,
	"plexTv"		:{
			"username"	: null,
			"password"	: null,
			"token"		: null,
			"hostname"	: constants.plexTvHostname,
			"port"		: constants.plexTvPort
	},
	"servers"		: [],
	"players"		: [],
	"selected": {
		"server"	: {
			"hostname" : false
		},
		"player"	: {
			"hostname" : false
		}
	}
}

var REMOTE_MODE = true;


var self = {};

self.init = function(){
	
	Homey.manager('speech-input').on('speech', self.processConversation);

	// Homey.settings = {};

	// return;

	if(typeof Homey.settings.servers == "undefined"){
		Homey.settings = defaultPlexSettings;	
	}
	
	
	// Merge the defaults to the Homey settings so all objects exist.
	// merge(Homey.settings, defaultPlexSettings);

	console.log(Homey.settings);

	self.setPlexTv();


	if(!Homey.settings.selected.server.hostname || !Homey.settings.selected.player.hostname){
		Homey.settings.hasSetup = false;
	} else {
		Homey.settings.hasSetup = true;
		self.setPlexServer();
		self.setPlexPlayer();
	}

	if(Homey.settings.hasSetup){

		// is the plexserver available?
		self.isServerAvailable().then(function(){
			console.log("server is available");

			// Prime the media cache.
			self.getMedia().then(function(media){
		    	console.log('getMedia', media.items.length);
		    });

		}, function(){
			// Homey.manager('speech-output').say("Plex is not available");	// Probably not needed on init.
			console.log("Plex server is NOT available");
		})

		// Check if player is available. Not really needed for live operation during init. Can wait until we truly get a request to play something
		self.isPlayerAvailable().then(function(result){
			console.log("Player is available!");
		}, function(){
			console.log("Player is NOT available!");
		});

	}

	console.log(__("hello", {name: "Homey user"}));

}

self.getHeaderOptions = function(){
	return {
		"identifier"	: constants.identifier,
		"product"		: constants.product,
		"version"		: constants.version,
		"deviceName"	: constants.deviceName,
		"platform"		: constants.platform
	};
}

self.getApiConfig = function(selected){

	return {
		"hostname" 		: selected.hostname,
		"port" 			: selected.port,
		"username" 		: selected.username || "",
		"password" 		: selected.password || "",
		"token"			: selected.token || "",
		"options"		: self.getHeaderOptions()
	};
}

self.setPlexServer = function(){
	if(Homey.settings.selected.server){
		plexServer = new PlexAPI(self.getApiConfig(Homey.settings.selected.server));
		return true;
	 } else {
		return false;
	}
}

self.setPlexPlayer = function(){
	if(Homey.settings.selected.player){
		plexPlayer = new PlexAPI(self.getApiConfig(Homey.settings.selected.player));
		return Homey.settings.selected.player;
	} else {
		return false;
	}
}

self.setPlexTv = function(){
	plexTv = new PlexAPI(self.getApiConfig(Homey.settings.plexTv));
}


self.getPlexPin = function(callback){

	plexTv.postQuery("/pins.xml").then(function(result){
		callback( result.pin );
	})
}

self.checkPlexPin = function(pinId, callback){

	console.log("checkPlexPin", pinId);

	plexTv.query("/pins/" + pinId + ".xml").then(function(result){
		
		// console.log(result);

		var valid = false;
		var token = result.pin.auth_token[0];

		if(token && typeof token == 'string' && token !==''){
			// We have a token! Now let's check if it belongs to the initial ID

			console.log("TOKEN FOUND", token);
			
			if(result.pin.id[0]._ == pinId){
				self.setPlexTvToken(token);
				//Re-init plexTv API
				self.setPlexTv();
				valid = true;
				console.log("Found valid plex.tv token", token);
			}
		} else {
			console.log("Plex token not found (yet)................");
		}

		callback( valid );
	})
}

self.setPlexTvToken = function(token){
	if(token && token !=""){
		Homey.settings.plexTv.token = token;
	}
}

self.storeServers = function(serverObject){
	// console.log("storeServers", serverObject);
	Homey.settings.servers = serverObject;

	// First unregister media triggers
	Homey.manager('speech-input').removeTrigger(serverTriggerIds, function(err){
		if(!err){
				console.log("Unregistering server triggers done");
			} else {
				console.log(err);
			}
	

		for(var a =0; a < serverObject.length; a++){
			var currentServer = serverObject[a].attributes;	
			var id = "server|" + a;
			var triggers = [];

			if(currentServer.owned == "1"){
				triggers.push('switch to own server');	
			}

			triggers.push("switch to " + currentServer.name);

			var triggerObject = {	
		    "id": id,
		    "importance": 0.6,
			"triggers": {
			        "en": triggers
			    }
			}

			console.log(triggerObject);

			Homey.manager('speech-input').addTrigger(triggerObject, function(err, result){
				// console.log('args', arguments);
				if(!err){
					console.log("Registering server trigger done");
					serverTriggerIds.push(id);
				} else {
					console.log(err);
				}
			}); 

		}

	})
	
}

self.storePlayers = function(devicesObject){
	// console.log("storePlayers", devicesObject);

	var players = [];

	devicesObject.forEach(function(device){

		if(device.attributes.provides == "player" && device.attributes.name !=""){
			players.push(device)
		}

	})

	Homey.settings.players = players;
}


self.getSettings = function(){
	return Homey.settings;
}

self.resetSettings = function(){
	// Homey.settings.servers.length = 0;
	// Homey.settings.players.length = 0;
	// Homey.settings.selected.player = null;
	// Homey.settings.selected.server = null;
	// Homey.settings.plexTv.token = null;
	// Homey.settings.hasSetup = false;

	for( var key in Homey.settings ) { delete Homey.settings[ key ] }

	Homey.settings = defaultPlexSettings;
}

self.getPlexServers = function(callback){


	plexTv.query("/pms/servers.xml").then(function(result){
		// console.log(result.MediaContainer.Server);
		callback(result.MediaContainer.Server);
		self.storeServers(result.MediaContainer.Server);
	}, function(){
		console.log("Failed to get servers from Plex.tv");
	})
}

self.getPlexPlayers = function(callback){

	plexTv.query("/devices.xml").then(function(result){
		// console.log(result.MediaContainer);
		callback(result.MediaContainer);
		self.storePlayers(result.MediaContainer.Device);
	}, function(){
		console.log("Failed to get players from Plex.tv");
	})
}

self.isServerAvailable = function(){
	var deferred = Q.defer();
	
	if(self.setPlexServer()){

		plexServer.query("/").then(function (result) {
			console.log("Media server found: " + result.friendlyName);
		    if(result.machineIdentifier != ""){
		    	console.log("Machine identifier found: " + result.machineIdentifier);
		    	self.machineId = result.machineIdentifier;
		    	deferred.resolve(true);
		    }
		
		}, function (err) {
			console.log("Could not connect to Plex Media Server: " +  err);
			deferred.reject();
		});

	} else {

		deferred.reject("No plex servers available");
	}

	return deferred.promise;

}

self.isPlayerAvailable = function(){

	console.log("isPlayerAvailable");

	var deferred = Q.defer();
	
	var player = self.setPlexPlayer();

	if(player){

		console.log("Connecting player: ", player);

		plexPlayer.query("/player/playback").then(function(result){
			return deferred.resolve(true);
		}, function(err){
			return deferred.reject("I'm sorry, I could not connect to your media player, is it running?");
		});

	} else {
		
		deferred.reject('No plex player selected');
	
	}

	return deferred.promise;
}

self.getPlexToken = function(api, config){

	var deferred = Q.defer();

	PlexAuth(config).authenticate(api, function(empty, token){
		deferred.resolve({"server": config.hostname, "token": token});
	});

	return deferred.promise;

}

self.setSelectedDevice = function(args){

	console.log("setSelectedDevice", args);

	var device = args.device;

	if(args.type == "player"){
		Homey.settings.selected.player = self.getPlayerTemplate(device);
		
	};

	if(args.type == "server"){
		Homey.settings.selected.server = self.getServerTemplate(device);
		self.updateMediaCache();
		
	};

	if(Homey.settings.selected.server.hostname && Homey.settings.selected.player.hostname){
		Homey.settings.hasSetup = true;
	} else {
		Homey.settings.hasSetup = false;
	}

	return true;

}

self.getPlayerTemplate = function(device){

	var hostname = device.publicAddress;
	var port     = 3005;
 
	if(device.Connection){
		var urlParts = url.parse(device.Connection[0].attributes.uri);
		hostname = urlParts.hostname;
		port = urlParts.port;
	}

	// OVERWRITE FOR REMOTE (VIRTUAL HOMEY) TESTING
	if(REMOTE_MODE){
		hostname = device.attributes.publicAddress;	
	}

	return {
		"name" 				: device.attributes.name,
		"clientIdentifier"  : device.attributes.clientIdentifier,
		"token"				: device.attributes.token,
		"hostname"			: hostname,
		"port"				: port
	}
}

self.getServerTemplate = function(device){

	// TODO: let the user make a choice to access using the remote IP or the local network (for owned servers)

	return {
		"name" 				: device.attributes.name,
		"machineIdentifier" : device.attributes.machineIdentifier,
		"token"				: device.attributes.accessToken,
		"hostname"			: device.attributes.host,
		"port"				: device.attributes.port,
		"owned"				: device.attributes.owned,
		"local"				: device.attributes.localAddresses.split(',')[0]
	}
}

self.refreshMediaServer = function(){

	var deferred = Q.defer();
	

	plexServer.query("/library/sections/all/refresh").then(function (result){
		
		console.log("Fired PMS update request")

	}, function(err) {

		console.log(err);
	
	});

	setTimeout(function(){

		self.updateMediaCache().then(function(result){
			deferred.resolve(result.media);
		});

	},15000);

	return deferred.promise;

}

self.updateMediaCache = function(){
	
	var outerPromise = Q.defer();
	var itemPromises = [];

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

	self.unRegisterMediaTriggers(function(err){


		if(err){
			console.log("unRegisterMediaTriggers ERROR", err);
		}

		// clear mediaTriggerIds
		mediaTriggerIds.length = 0;

		// Loop through supported media types
		plexConfig.supportedMediaTypes.forEach(function(type){
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
			function(result){
				console.log("Media Cache Updated");
				mediaCache.updated = +new Date();
				Homey.manager('speech-input').addTrigger(speechTriggers, function(err, result){
					// console.log('args', arguments);
					if(!err){
						console.log("Registering media triggers done");
						console.log("Plex ready for commands..");
					} else {
						console.log(err);
					}
				}); 
				outerPromise.resolve({media: mediaCache, fromcache: true});
			}, function(err){
				console.log(err);
				outerPromise.reject(err);
			}
		);


	});
	

	return outerPromise.promise;

}

self.cacheMediaByType = function(type){
	
	
	var deferred = Q.defer();

	// Check if type is correct
	if(typeof mediaTypes[type] == 'undefined') {
		console.log("Unknown media type: " + type);
		return deferred.reject();
	}

	plexServer.query("/library/all?type=" + mediaTypes[type]).then(function (result){
		console.log("Found " + result._children.length + " media items of type: " + type);
		console.log("Adding " + type + " to cache.......");

		var count = 0;

		result._children.forEach(function(mediaItem){
			if(mediaItem._elementType == 'Video'){
				var cacheItem = self.createMediaCacheItem(mediaItem);
				mediaCache.items.push(cacheItem);
				
				self.addToIndexer(type, cacheItem);

				if(typeof mediaItem.viewCount == 'undefined'){
					self.addToIndexer('neverwatched', cacheItem);
				}

				self.registerMediaTrigger(cacheItem);
			}
		});

		return deferred.resolve();
	
	}, function(err) {
		console.log(err);
		return deferred.reject({});
	});

	return deferred.promise;
},

self.cacheOndeck =  function(){
	
	var deferred = Q.defer();
	var type = 'ondeck';

	plexServer.query("/library/onDeck").then(function(result){
		console.log("Found " + result._children.length + " On Deck items");
		console.log("Adding ondeck items to cache.......");
		result._children.forEach(function(mediaItem){
			if(mediaItem._elementType == 'Video'){
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

self.cacheRecent =  function(){
	
	var deferred = Q.defer();
	var type = 'recent';

	plexServer.query("/library/recentlyAdded").then(function(result){
		console.log("Found " + result._children.length + " Recent items");
		console.log("Adding recent items to cache.......");
		result._children.forEach(function(mediaItem){
			if(mediaItem._elementType == 'Video'){
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

self.addToIndexer = function(indexType, item){

	if(typeof indexers[indexType] === 'undefined') {
		indexers[indexType] = new lunr(function(){
			this.field('title', {boost: 10});	// Title is most important
			this.field('episodeTitle', {boost: 5});
			this.field('episodeindex');
			this.field('compoundEpisodeIndex', {boost: 3});
			this.field('season');
			this.field('key');
			this.ref('key');					// index ID is the PMS play key or the path within PMS
		});
	}
	indexers[indexType].add(item);

}

self.registerMediaTrigger = function(mediaItem){

	var id = "media|" + mediaItem.type + "|" + mediaItem.key;

	if(mediaItem.episodeTitle.toLowerCase().indexOf('episode') > -1){
		mediaItem.episodeTitle = "";
	}

	mediaItem.episodeTitle = mediaItem.episodeTitle.replace("(", "");
	mediaItem.episodeTitle = mediaItem.episodeTitle.replace(")", "");
	mediaItem.episodeTitle = mediaItem.episodeTitle.replace("&", "and");
	mediaItem.title = mediaItem.title.replace("&", "and");
	mediaItem.title = mediaItem.title.replace("III", "3");
	mediaItem.title = mediaItem.title.replace("II", "2");
	mediaItem.title = mediaItem.title.replace("-", "");
	

	var triggers = [];

	if(mediaItem.type == 'episode'){
		triggers.push(mediaItem.title + " " + mediaItem.season + " " + mediaItem.episodeIndex);
	}
	
	if(mediaItem.episodeTitle){
		triggers.push(mediaItem.title + " " + mediaItem.episodeTitle);
	}

	if(mediaItem.title){
		triggers.push(mediaItem.title);
	}

	if(mediaItem.primaryTitle && (mediaItem.title != mediaItem.primaryTitle) ){
		triggers.push(mediaItem.primaryTitle);
	}

	if(mediaItem.secondaryTitle){
		triggers.push(mediaItem.secondaryTitle);
	}	

	if(mediaItem.titleSort){
		triggers.push(mediaItem.titleSort);
	}


	var triggerObject = {	
	    "id": id,
	    "importance": 0.1,
	    "triggers": {
	        "en": triggers
	    }
	}

	speechTriggers.push(triggerObject);
	mediaTriggerIds.push(id);

}

self.unRegisterMediaTriggers = function(callback){

	Homey.manager('speech-input').removeTrigger(mediaTriggerIds, function(err){
		if(!err){
			console.log("Unregistering media triggers done");
		} else {
			console.log(err);
		}

		if(typeof callback == 'function'){ callback(); }
	})

}
	

self.createMediaCacheItem = function (mediaChild){

	var cacheTemplate = {
		"machineIdentifier" 	: Homey.settings.selected.server.machineIdentifier,
		"type"					: mediaChild.type,
		"title"					: (mediaChild.type == 'movie') ? mediaChild.title : mediaChild.grandparentTitle,
		"key"					: mediaChild.key,
		"episodeTitle"			: (mediaChild.type == 'episode') ? mediaChild.title : "",
		"episodeIndex"			: (mediaChild.type == 'episode') ? "episode " + mediaChild.index : "",
		"season"				: (mediaChild.type == 'episode') ? "season " + mediaChild.parentIndex : "",
		"primaryTitle"			: false,
		"secondaryTitle" 		: false,
		"titleSort"				: (mediaChild.titleSort) ? mediaChild.titleSort : false,
		"score"					: 0,
		"compoundEpisodeIndex"	: 0,
		"viewOffset"			: mediaChild.viewOffset || null
	};

	if(cacheTemplate.title.indexOf(':') > 1){
		cacheTemplate.primaryTitle 		= cacheTemplate.title.split(':')[0].trim();
		cacheTemplate.secondaryTitle 	= cacheTemplate.title.split(':')[1].trim();
		cacheTemplate.title 			= cacheTemplate.title.replace(": ", " ");
	} else {
		cacheTemplate.primaryTitle = cacheTemplate.title;
	}

	if(cacheTemplate.type == 'episode'){
		cacheTemplate.compoundEpisodeIndex = (mediaChild.parentIndex * 1000) + parseInt(mediaChild.index);
	}

	return cacheTemplate;
}

self.getMedia = function(){

	var deferred = Q.defer();

	console.log("getMedia()");
	console.log("cache size: " + mediaCache.items.length);

	if(mediaCache.items.length > 0){
		console.log("Media from cache");
		deferred.resolve(mediaCache);
	} else {
		self.updateMediaCache().then(function(result){
			console.log("Media from updated cache");
			deferred.resolve(result.media);
		});
	}

	return deferred.promise;
}

self.getSessions = function(){

	var deferred = Q.defer();
	
	plexServer.query("/status/sessions").then(function(sessions){
        // console.log(sessions);
        var response = [];
        
        sessions._children.forEach(function(session){
            response.push(session);
        });

        deferred.resolve(response);
    });

    return deferred.promise;
}

self.processConversation = function(speechObject){
	
	console.log('speechObject', speechObject);
	
	// parse the speech object 
	var speechResults = {
		commands	: [],
		types 		: [],
		media 		: [],
		server 		: [],
		zones		: speechObject.zones,
		transcript	: speechObject.transcript
	};

	var zone = (speechResults.zones.length > 0) ? speechResults.zones[0] : 'default';
	
	// Go through the triggers and find corresponding items:
	console.log("parsing triggers");
	speechObject.triggers.forEach(function(trigger){

		var elems = trigger.id.split("|");

		if(elems.length > 1){

			if(elems[0] == 'command'){
				speechResults.commands.push(elems[1]);
			}

			if(elems[0] == 'type'){
				speechResults.types.push(elems[1])
			}

			if(elems[0] == 'media'){
				speechResults.media.push({"match":trigger.text, "type": elems[1], "ref": elems[2]});
			}

			if(elems[0] == 'server'){
				speechResults.server.push(elems[1]);
			}

		}

	});

	console.log("speechResults", speechResults);


	if(speechResults.server.length > 0){
		var selectedServerObject = Homey.settings.servers[parseInt(speechResults.server)];
		self.setSelectedDevice({"type": "server", "device":selectedServerObject});
		Homey.manager('speech-output').say("Media server set to " + selectedServerObject.attributes.name);
		return;
	}

	if(speechResults.commands.length > 0){
		
		if(speechResults.commands.indexOf('watch') > -1){

			// Okay, user wants to watch something.

			var speechMedia = speechResults.media;
			var speechMediaLength = speechMedia.length;


			// First check the specific command cases
			if(speechMediaLength == 0){
				if(speechResults.commands.indexOf('random') > -1 && speechResults.types.indexOf('movie') > -1){
					
					Homey.manager('speech-output').say("Playing random movie from your collection!");

					// Get movies from cache
					var tempMovies = self.filterMediaItemsBy('type', 'movie', mediaCache.items);
					self.playItemInZone(zone, tempMovies[Math.floor(Math.random() * tempMovies.length)]);
					return;
				}
			}

			// Find out if we have a media item match:

			if(speechMediaLength == 1){	// One result - easy peasy.
				var mediaItem = self.keyToMediaItem(speechMedia[0].ref);

				// There can be only one!
				console.log("Found single :" + mediaItem.type);
				console.log("Going to try to play: ", mediaItem.title);
				console.log("Waiting for player.......");

				self.playItemInZone(zone, mediaItem);
				return;
			
			} else if (speechMediaLength > 1){ 	// Multiple results on speech match
				
				console.log("More than 1 result, namely: " + speechMediaLength);
				
				var longestItems = self.getLongestItemsInSpeechMedia(speechMedia);

				console.log("After filter for longest items", longestItems.length);
				
				if(longestItems.length == 1){
					console.log("Found single longest item, assuming best match");
					console.log(longestItems);
					var mediaItem = self.keyToMediaItem(longestItems[0].ref);
					self.playItemInZone(zone, mediaItem);
					return;

				} else {
					
					// Convert found speech keys to actual media items:
					var mediaItemSelection = self.indexToMediaArray(longestItems, mediaCache.items);

					// console.log("mediaItemSelection", mediaItemSelection);

					// Break up items into series and movies:
					var seriesMedia = self.filterMediaItemsBy("type","episode", mediaItemSelection)
					var moviesMedia = self.filterMediaItemsBy("type","movie", mediaItemSelection);
					var lastType = speechResults.types[speechResults.types.length-1] || null;
					var remainingMedia = [];


					// Check for possible single results (shortcut as if we do have a single result, we can immediately play without further processing):
					if( lastType == 'movie' && moviesMedia.length == 1 ){

						console.log("Found speech type movie, with a single speech result -> playing!", moviesMedia[0]);
						self.playItemInZone(zone, moviesMedia[0]);
						return;

					}

					if( lastType == 'episode' && seriesMedia.length == 1){
						console.log("Found speech type series, with a single speech result -> playing!", seriesMedia[0]);
						self.playItemInZone(zone, seriesMedia[0]);
						return;
					}

					if(speechResults.commands.indexOf('random') > -1){
						if(lastType == 'episode'){
							console.log("Playing random episode");
							self.playItemInZone(zone, seriesMedia[Math.floor(Math.random() * seriesMedia.length)]);
							return;
						}

						if(lastType == 'movie'){
							console.log("Playing random episode");
							self.playItemInZone(zone, moviesMedia[Math.floor(Math.random() * moviesMedia.length)]);
							return;
						}
					}


					// Do we need to ask the user for a type?
					// Check if we only have one type left or if speech contained a type:
					
					if(seriesMedia.length == 0 || moviesMedia.length == 0 ){
						remainingMedia = (seriesMedia.length > 0) ? seriesMedia : moviesMedia;
						if(!lastType){
							lastType = (seriesMedia.length > 0) ? "episode" : "movie";
						}
					}

					if(remainingMedia.length == 0 && !lastType){ // We have a mixed result, and no speech type. 
						
						// Ask user for type
						console.log("ASK", "Would you like to watch a movie or a series?");
						
						self.askQuestion("Would you like to watch a movie or a series?", ['movie', 'series']).then(function(result){

							console.log("Valid response from askQuestion", result);

							if(result == 'abort'){
								return;
							}

							if(result == 'movie'){ 					
						    	remainingMedia = moviesMedia;
						    } else if( result == 'series'){
								remainingMedia = seriesMedia;				    	
						    }

						    self.getSingleResult(remainingMedia, speechResults);
						    return;


						}, function(err){

							console.log("Invalid response from askQuestion", err);
							Homey.manager('speech-output').say("Sorry... I didn't understand " + err + ". Please try again."); 

						})

					} else {

						console.log("lastType", lastType);
						// console.log("moviesMedia", moviesMedia);
						// console.log("seriesMedia", seriesMedia);

						if(lastType == 'movie'){
							self.getSingleResult(moviesMedia, speechResults);
						}

						if(lastType == 'episode'){
							self.getSingleResult(seriesMedia, speechResults);
						}
					
					}		
				}
			}

			if(speechResults.commands.indexOf('watchnextepisode') > -1){
			
				self.getSessions().then(function(current){
					

					// console.log("Active playing session found", current);

					if(current.length == 0){
						console.log("No active player session found");
						Homey.manager('speech-output').say("No active watch sessions found. I'm not sure what you want to watch. Please start over");
						return;
					}

					var mediaItem = self.createMediaCacheItem(current[0]);


					console.log("mediaItem", mediaItem);

					if(mediaItem.type == 'episode'){

						var currentEppie = mediaItem.compoundEpisodeIndex;
						var currentTitle = mediaItem.title;

						var nextCompoundIndex = parseInt(currentEppie) + 1;

						var results = indexers['episode'].search(currentTitle + " " + nextCompoundIndex);

						if(results.length > 0){
							self.playItemInZone(zone, self.keyToMediaItem(results[0].ref));
						} else {
							Homey.manager('speech-output').say("Sorry, I couldn't find the next episode for " + currentTitle);
							return;
						}

					} 

				})
			}

			// No match in the media speech triggers or the type triggers. 
			// Speech might have misunderstood, the user might nog have asked for a media item yet, or the item asked for
			// doesn't exist in the Plex lib.

			if(speechMediaLength == 0 && speechResults.types.length == 0){
				console.log("speech-output", "What would you like to watch?");

				// Pretty much unknown what the user wants. I have a 'watch' command, but no type (movie|episode) and no title.
				// We need to abort here.

				var unknownString = speechResults.transcript.replace('watch', '').trim();


				Homey.manager('speech-output').say("Sorry, I don't know what you mean with " + unknownString);
				console.log("SAY", "Sorry, I don't know what you mean with " + unknownString)
				return;
			}

			// Scenario: "I want to watch a movie|series|show"
			// So user wants to 'watch' something and a type has been recognised
			// No matching media found
			// TODO: ask for title of type

			if(speechMediaLength == 0 && speechResults.types.length == 1){
				console.log("speech-output", "What " + speechResults.types[0] +" would you like to watch?");
				Homey.manager('speech-output').say("What  " + speechResults.types[0] + " would you like to watch?"); // ask
			}
		}


		if(speechResults.commands.indexOf('pause') > -1){
			self.controls().pause();
		}
		if(speechResults.commands.indexOf('continue') > -1){
			self.controls().play();
		}
		if(speechResults.commands.indexOf('stop') > -1){
			self.controls().stop();
		}
		if(speechResults.commands.indexOf('refresh') > -1){
			self.updateMediaCache();
		}

		if(speechResults.commands.indexOf('currentlyplaying') > -1){
			self.getSessions().then(function(current){
				
				console.log("Active playing session found", current);

				var friendly = "";
				var mediaItem = self.createMediaCacheItem(current[0]);
				console.log(mediaItem);

				if(mediaItem.type == 'episode'){

					friendly = "You are watching an episode of " + mediaItem.title + " named " + mediaItem.episodeTitle + ", " + mediaItem.season + ", " + mediaItem.episodeIndex;

				} else {

					friendly = "You are watching " + mediaItem.title;

				}

				console.log(friendly);
				Homey.manager('speech-output').say(friendly);
			})
		}

	}
}

self.getSingleResult = function(selection, speechResults){ 
	// If we got here, we HAVE to get to a single result, otherwise we can only abort.
	// We are expecting a selection (1 to many), all of the same type (movie or series). Speech matching might already have yielded a single result.
	
	console.log("GOING TO getSingleResult() with number of items", selection.length);

	var zone = (speechResults.zones.length > 0) ? speechResults.zones[0] : 'default';
	var speechMatch = speechResults.media[0].match;
	var numResults = selection.length;
	var titles = [];
	var secondaryTitles = [];

	console.log("getSingleResult", selection);

	if(selection.length == 0){
		console.log("Something is wrong, probably failed to register the speech triggers correctly");
		return;
	}

	if(selection.length == 1){ // Okay... that was easy... (it is a possible scenario)
		self.playItemInZone(zone, selection[0]);
		return;
	}

	var currentType = selection[0].type;
	console.log("currentType", currentType);

	if(currentType == 'movie'){
		// Something like transformers, transformers dark of the moon and transformers revenge of the fallen

		console.log("Found "+ numResults + " movies, with the title " + speechMatch);

		if(numResults < 5){
			titles = self.getMetaFromMedia("title", selection);
			console.log(titles);
		}

		// fetch seconday titles for allowed speech result:
		secondaryTitles = self.getMetaFromMedia("secondaryTitle", selection);
		secondaryTitles.push(speechMatch);

		console.log("secondaryTitles", secondaryTitles);

		var question = "I found " + numResults + " matching results for " + speechMatch + ". Which would you like to watch? ";
		question += titles.join(",");
		question += "?";


		self.askQuestion(question, titles.concat(secondaryTitles)).then(function(result){

			console.log("MATCH", result);

			var selected = self.filterMediaItemsBy("title", result, selection);
			
			if( selected.length == 0 ){
				selected = self.filterMediaItemsBy("secondaryTitle", result, selection);
			}

			console.log("selected", selected);
			self.playItemInZone(zone, selected[0]);
			return true;

		},function(err){

			console.log("FAIL:", err);
			Homey.manager('speech-output').say("Sorry, I couldn't find a match for " + result + ". Please start over");
			return false;

		})
	}

	if(currentType =='episode'){

		console.log("Found "+ numResults + " episodes, with the title " + speechMatch);

		// Did we maybe have another clue in the speech match commands?
		if(speechResults.commands.indexOf('latest') > -1){ // So user wants to watch the latest episode, but it was somehow not on deck?

			var newestEppie = self.getNewestEpisode(selection);
				
			console.log("newestEppie", newestEppie);

			if(newestEppie){
				Homey.manager('speech-output').say("Okay, playing the most recent episode of " + speechMatch);
				self.playItemInZone(zone, newestEppie);
				return true;

			}

		}

		if(speechResults.commands.indexOf('first') > -1){ // So user wants to watch the latest episode, but it was somehow not on deck?

			var firstEppie = self.getLowestEpisode(selection);
				
			console.log("firstEppie", firstEppie);

			if(firstEppie){
				Homey.manager('speech-output').say("Okay, playing the oldest episode of " + speechMatch);
				self.playItemInZone(zone, lowestNeverWatched);
				return true;
			}

		}

		if(speechResults.commands.indexOf('random') > -1){ // So user wants to watch the latest episode, but it was somehow not on deck?

			self.playItemInZone(zone, selection[Math.floor(Math.random() * selection.length)]);
			return;

		}

		var episodesOnDeck = [];

		// we have a selection of mediaItems here. Let's check any match the mediaItems in ondeck:
		episodesOnDeck = self.getMatchingItems(selection, mediaCache.ondeck);
		console.log("episodesOnDeck", episodesOnDeck);

		if(episodesOnDeck.length == 1){ // Yeah! 1 result on deck. Let's play it.
			self.playItemInZone(zone, episodesOnDeck[0]);
			return true;
		}

		if(episodesOnDeck.length > 1){ // multiple episode results on Deck found, let's determine te one to play:

			var lowestEpisode = self.getLowestEpisode(episodesOnDeck);
			if(lowestEpisode) {
				self.playItemInZone(zone, lowestEpisode);
				return true;
			}
		}

		// No match yet.. Let's check recently added:
		var episodesRecent = self.getMatchingItems(selection, mediaCache.recent);
		console.log("episodesRecent", episodesRecent);

		if(episodesRecent.length == 1){ // Yeah! 1 result on deck. Let's play it.
			self.playItemInZone(zone, episodesRecent[0]);
			return true;
		}

		if(episodesRecent.length > 1){ // multiple episode results on Deck found, let's determine te one to play:

			var lowestEpisode = self.getLowestEpisode(episodesRecent);
			if(lowestEpisode) {
				self.playItemInZone(zone, lowestEpisode);
				return true;
			}
		}


		// Okay, this is the last stop. We still haven't found what we're looking for (a single episode to play)
		// Let's put the indexers to work.



		console.log("LAST STOP: ", selection.length, "episodes left");
		console.log("selection", selection);

		// Let's check the indexer result for 'never watched'
		var neverWatchedItems = indexers['neverwatched'].search(speechMatch);

		if(neverWatchedItems.length > 0){
			var neverWatchedMedia = self.indexToMediaArray(neverWatchedItems, selection);

			if(neverWatchedMedia.length == 1){
				self.playItemInZone(zone, neverWatchedMedia[0]);
				return true;
			}

			if(neverWatchedMedia.length > 1){
				var lowestNeverWatched = self.getLowestEpisode(neverWatchedMedia);

				if(lowestNeverWatched){
					self.playItemInZone(zone, lowestNeverWatched);
					return true;
				}
			}

		}

		// Okay, we are still not successful. We need to try to get a match by asking more information I guess..

		var question = "Sorry, I do not have enough information to find what you want to watch. Do you have any more information on what episode of " + speechMatch + " you want to watch?";

		self.askQuestion(question, false).then(function(result){
			
			if(result.indexOf('no') > -1 || result.indexOf('first') > -1) { // Let's just play the first eppie
				console.log("no or first");
				var firstEppie = self.getLowestEpisode(selection);
				
				console.log("firstEppie", firstEppie);

				if(firstEppie){
					Homey.manager('speech-output').say("Okay, playing the oldest episode of " + speechMatch);
					self.playItemInZone(zone, lowestNeverWatched);
					return true;
				}
			}

			if(result.indexOf('newest') > -1 || result.indexOf('latest') > -1) {
				console.log("latest or newest");
				
				var newestEppie = self.getNewestEpisode(selection);
				
				console.log("newestEppie", newestEppie);

				if(newestEppie){
					Homey.manager('speech-output').say("Okay, playing the most recent episode of " + speechMatch);
					self.playItemInZone(zone, newestEppie);
					return true;

				}
			}

			if(result.indexOf('random') > -1 || result.indexOf('any') > -1) {
				console.log("random or any");
				var randMedia = selection[Math.floor(Math.random() * selection.length)];
				console.log("randMedia", randMedia)
				Homey.manager('speech-output').say("Okay, playing a random episode of " + speechMatch);
				
				self.playItemInZone(zone, randMedia);
				
				return true;

			}

			Homey.manager['speech-output'].say("I'm sorry master, I failed you. Please start over");


		}, function(err){

			Homey.manager('speech-output').say("I'm sorry master, I failed you. Please start over");

		})


		return;

	}

	return false;


}

self.getMetaFromMedia = function(key, selection){

	var meta = [];

	selection.forEach(function(item){
		if(item[key]){
			meta.push(item[key].toLowerCase())
		}
	})

	return meta;

}

self.getMatchingItems = function(selection, media){

	var matches = [];
	var keys = [];

	selection.forEach(function(item){
		keys.push(item.key);
	})

	media.forEach(function(item){
		var keyIndexMatch = keys.indexOf(item.key);
		if(keyIndexMatch > -1){
			matches.push(item);
		}
	});

	return matches;

}

self.askQuestion = function(question, allowedAnswers){

	
	var deferred = Q.defer();

	console.log("question", question);

	Homey.manager('speech-input').ask(question, function(err, result){
		if( err ) {
	    	console.log("ASK ERROR", err);
	    	// Homey.error( err );
	    	return deferred.reject(err);
	    }

	    result = result.trim().toLowerCase();
	    console.log("ANSWER", result);

	    if(allowedAnswers){
	    	

	    	for(var a =0; a < allowedAnswers.length; a++){
	    		var allowedAnswer = allowedAnswers[a];
	    		
	    		console.log("allowedAnswer", allowedAnswer);
	    		console.log("indexOf", result.indexOf(allowedAnswer));
	    		
	    		if(result.indexOf(allowedAnswer) > -1){
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

self.playItemInZone = function(zone, mediaItem) {

	// Prep for being able to play item in selected zone, found in speech.
	// not yet applicable as we are not setup as a driver yet and cannot get the users zones 
	// from the settings page unfortunately..

	console.log("playItemInZone", mediaItem);

	self.controls().play(mediaItem);

	

	// self.isPlayerAvailable(zone).then(function(){
	// 	console.log("playerAvailable: ", true);
	// 	console.log("mediaItemto play", mediaItem);
	// 	self.controls().play(mediaItem);
	// 	Homey.manager('speech-output').say('Enjoy watching ' + mediaItem.title);
	// },function(err){
	// 	Homey.manager('speech-output').say('Sorry, your plex player is not availble');
	// 	console.log("Player in zone: " + zone + " is not available", err);
	// });

}

self.indexToMediaArray = function(index, selection){
	var tempArray = [];
	var keys = [];

	index.forEach(function(indexItem){
			keys.push(indexItem.ref);
	});

	selection.forEach(function(item){
		var keyIndexMatch = keys.indexOf(item.key);
		if(keyIndexMatch > -1){
			item.score = index[keyIndexMatch].score || 0;
			tempArray.push(item);
		}
	});

	return tempArray;
}

self.keyToMediaItem = function(key){

	for(var a=0; a < mediaCache.items.length; a++){
		var curItem = mediaCache.items[a];
		if(curItem.key == key){
			return curItem;
		}
	}
}

self.getLongestItemsInSpeechMedia = function(speechMedia){
	
	if(speechMedia.length < 2){ // shouldn't happen, but just in case
		return speechMedia;
	}

	var longestItems = [];
	var controlLength = 0;

	for(var a = 0; a < speechMedia.length; a++){
		
		if(speechMedia[a].match.length > controlLength){	// We found a larger item, reset the array and push
			longestItems.length =0;
			longestItems.push(speechMedia[a]);
			controlLength = speechMedia[a].match.length;
		} else if(speechMedia[a].match.length == controlLength){
			longestItems.push(speechMedia[a]);
		}

	}

	return longestItems;
}

self.getBestResult = function(selection){

	var bestResult = selection[0] || null;


	for(var a = 0; a < selection.length; a++){
		if(selection[a].score > bestResult.score){
			bestResult = selection[a];
		}
	}

	return bestResult;

}

self.getLowestEpisode = function(episodes){

	var lowestEpisode = episodes[0];

	for(var a = 0; a < episodes.length; a++){
	
		var curEppiIndex = parseInt(episodes[a].compoundEpisodeIndex);
		var lowestIndex = parseInt(lowestEpisode.compoundEpisodeIndex);

		if ( curEppiIndex < lowestIndex ) {
			lowestEpisode = episodes[a];
		}
	}

	return lowestEpisode;

}

self.getNewestEpisode = function(episodes){

	console.log("determine newest episode from selection of " + episodes.length);

	var newestEpisode = episodes[0];

	for(var a = 0; a < episodes.length; a++){
	
		var curEppiIndex = parseInt(episodes[a].compoundEpisodeIndex);
		var newestIndex = parseInt(newestEpisode.compoundEpisodeIndex);

		if ( curEppiIndex > newestIndex ) {
			newestEpisode = episodes[a];
		}
	}

	return newestEpisode;
}

self.filterMediaItemsBy = function(key, value, selection){

	var result = [];

	console.log("filterMediaItemsBy", arguments);

	selection.forEach(function(item){
		
		if(item[key] && value){
			if(item[key].toLowerCase() == value.toLowerCase()){
				result.push(item);
			}
		}

	});

	return result;

}


self.controls = function(){
	
	var performer = function(action, item){

		console.log("performer ", arguments);
		
		self.isPlayerAvailable().then(function(){


			var prefix = "/player/playback/";
			var payload = action;
			var postfix = "";

			switch (action){
				case 'play':

					if(item){
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

			plexPlayer.perform(perform).then(function(result){
		    	console.info(action)
		    },function(err){
		        console.log(err);
		        Homey.manager('speech-output').say(err);
		    });

		}, function(err){
			console.log(err);
			Homey.manager('speech-output').say(err);
		})

	}


	return  {
		play: function(item){
			performer('play', item);
		},
		pause: function(){
			performer('pause');
		},
		stop: function(){
			performer('stop');
		},
		forward: function(){
			performer('stepForward');
		},
		setVolume: function(volume){
			performer('setParameters', 'volume='+volume);
		},
		toggleOSD: function(){
			performer('toggleOSD');
		}

	}
}

self.api = {

	getPin: self.getPlexPin,
	checkPin: self.checkPlexPin,
	getServers : self.getPlexServers,
	getPlayers : self.getPlexPlayers,
	getSettings: self.getSettings,
	resetSettings: self.resetSettings,
	setSelectedDevice: self.setSelectedDevice

}

module.exports = {
	init: self.init,
	api: self.api
};








