var plexConfig = {

	"supportedMediaTypes" 	: ['movie', 'episode'],
	"remoteMode" 			: false,
	"supportedPlayers" 		: ["Plex Home Theater", "Plex Media Player"],
	"installedDrivers" 		: ["pht", "chromecast", "pmp"],
	"autoUpdateTime"		: 1800000, // 30 minutes
	"allowSharedServers"	: false,
	"defaultPort"			: 32400,
	"maxPinTries"			: 20,
	"pinTimeOut"			: 5000,	// Milliseconds,
	"titleReplacements"		: [
								["(", ""],
								[")", ""],
								["&", "and"],
								["III", "3"],
								["II", "2"],
								[" – ", " "],
								[/-/g, " "],
								[/'/g, ""]
	]
};

module.exports = plexConfig;