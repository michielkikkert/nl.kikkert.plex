module.exports = [
    
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

            
        },
    },
    {
        description:    'Check for Plex PIN Token',
        method:         'GET',
        path:           '/checkPinToken',
        requires_authorizaton: false,
        fn: function( callback, args ){
            // console.log("args", args);
            console.log("Checking for token...");

            var pinId = args.query.id;

            console.log("pinId", pinId);

            var checkPin = Homey.app.api.checkPin;
            
            checkPin(pinId, function(result){
                callback(null, result);
            })

            
        },
    },

    {
        description:    'Get Plex server from plex.tv',
        method:         'GET',
        path:           '/getPlexServers',
        requires_authorizaton: false,
        
        fn: function( callback, args ){
            // console.log("args", args);
            console.log("Getting Plex servers");

            var getServers = Homey.app.api.getServers;
            
            getServers(function(result){
                callback(null, result);
            })
        },
    },

    {
        description:    'Get Plex players from plex.tv',
        method:         'GET',
        path:           '/getPlexPlayers',
        requires_authorizaton: false,
        
        fn: function( callback, args ){
            // console.log("args", args);
            console.log("Getting Plex servers");

            var getPlayers = Homey.app.api.getPlayers;
            
            getPlayers(function(result){
                callback(null, result);
            })
        },
    },

    {
        description:    'Get Homey settings',
        method:         'GET',
        path:           '/getSettings',
        requires_authorizaton: false,
        
        fn: function( callback, args ){
            // console.log("args", args);
            console.log("Getting settings");

            var getSettings = Homey.app.api.getSettings;
            
            callback(null, getSettings());
        },
    },

    {
        description:    'Reset Homey settings',
        method:         'GET',
        path:           '/resetSettings',
        requires_authorizaton: false,
        
        fn: function( callback, args ){
            // console.log("args", args);
            console.log("Resetting settings");

            var resetSettings = Homey.app.api.resetSettings;
            
            callback(null, resetSettings());
        },
    },
    {
        description:    'Set the selected device',
        method:         'POST',
        path:           '/setDevice',
        requires_authorizaton: false,
        
        fn: function( callback, args ){
            // console.log("args", args);
            console.log("Getting settings");

            var setSelectedDevice = Homey.app.api.setSelectedDevice;
            
            callback(null, setSelectedDevice(args.body));
        },
    }
]