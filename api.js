module.exports = [
    {
        description:    'Init Plex PIN process',
        method:         'GET',
        path:           '/initPin',
        requires_authorizaton: false,
        fn: function( callback, args ){
            console.log("init Pin process");

            var initPin = Homey.app.api.initPin;

            initPin(function(result){
                callback(null, result);    
            });
        }
    },
    {
        description:	'Get Plex PIN',
        method: 		'GET',
        path:			'/getpin',
        requires_authorizaton: false,
        fn: function( callback, args ){
            console.log("getPin");

            var getPin = Homey.app.api.getPin;

            getPin(function(result){
                callback(null, result);    
            });   
        }
    },
    {
        description:    'Check for Plex PIN Token',
        method:         'GET',
        path:           '/checkPinToken',
        requires_authorizaton: false,
        fn: function( callback, args ){
            console.log("Checking for token...");

            var pinId = args.query.id;
            var checkPin = Homey.app.api.checkPin;
            
            checkPin(pinId, function(result){
                callback(null, result);
            });
        }
    },
    {
        description:    'Get Plex server from plex.tv',
        method:         'GET',
        path:           '/getPlexServers',
        requires_authorizaton: false,
        fn: function( callback, args ){
            console.log("Getting Plex servers");

            var getServers = Homey.app.api.getServers;
            
            getServers(function(result){
                callback(null, result);
            });
        }
    },
    {
        description:    'Get Plex players from plex.tv',
        method:         'GET',
        path:           '/getPlexPlayers',
        requires_authorizaton: false,
        
        fn: function( callback, args ){
            console.log("Getting Plex players");

            var getPlayers = Homey.app.api.getPlayers;
            
            getPlayers(function(result){
                callback(null, result);
            })
        }
    },
    {
        description:    'Get Homey settings',
        method:         'GET',
        path:           '/getSettings',
        requires_authorizaton: false,
        
        fn: function( callback, args ){
            console.log("Getting settings");

            var getSettings = Homey.app.api.getSettings;
            
            callback(null, getSettings());
        }
    },
    {
        description:    'Update installed players',
        method:         'GET',
        path:           '/updateInstalledPlayers',
        requires_authorizaton: false,
        
        fn: function( callback, args ){
            console.log("Updating installed players");

            var updateInstalledPlayers = Homey.app.api.updateInstalledPlayers;
            
            updateInstalledPlayers(function(result){
                callback(null, result);
            });
        }
    },
    {
        description:    'Get Server Log',
        method:         'GET',
        path:           '/getLogs',
        requires_authorizaton: false,
        
        fn: function( callback, args ){
            console.log("Get log files");

            var getLogs = Homey.app.api.getLogs;
            
            getLogs(function(logs){
                callback(null, logs);
            })
            
        }
    },
    {
        description:    'Is Server Available',
        method:         'GET',
        path:           '/isServerAvailable',
        requires_authorizaton: false,
        
        fn: function( callback, args ){
            console.log("Get log files");

            var isServerAvailable = Homey.app.api.isServerAvailable;
            
            isServerAvailable(function(available){
                callback(null, available);
            })
          
            
        }
    },
    {
        description:    'Reset Homey settings',
        method:         'GET',
        path:           '/resetSettings',
        requires_authorizaton: false,
        
        fn: function( callback, args ){
            console.log("Resetting settings");

            var resetSettings = Homey.app.api.resetSettings;
            
            callback(null, resetSettings());
        }
    },
    {
        description:    'Set the selected device',
        method:         'POST',
        path:           '/setDevice',
        requires_authorizaton: false,
        
        fn: function( callback, args ){
            console.log("Getting settings");

            var setSelectedDevice = Homey.app.api.setSelectedDevice;
            
            callback(null, setSelectedDevice(args.body));
        }
    }
]