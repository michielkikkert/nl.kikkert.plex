var plexConfig = {

	"supportedMediaTypes" 	: ['movie', 'episode'],
	"remoteMode" 			: false,
	"supportedPlayers" 		: ["Plex Home Theater"],
	"installedDrivers" 		: ["pht", "chromecast"],
	"autoUpdateTime"		: 1800000,
	"allowSharedServers"	: false,
	"defaultPort"			: 32400,
	"maxPinTries"			: 20,
	"pinTimeOut"			: 5000	// Milliseconds
};

module.exports = plexConfig;