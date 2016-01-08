var fs			= require('fs');
var path		= require('path');

var _			= require('underscore');
var request		= require('request');

module.exports.run = function( animation_path ) {
	
	
	// verify if the folder has a homey app
	if( !fs.existsSync(animation_path) ) return console.error("invalid animation file folder. Give the file as argument (--run <path>)".red);
	
	// compile animation
	var animation = require(animation_path);
		
	// get active homey
		
	if( typeof global.settings.homey == 'undefined' ) {
		global.lib.homey.select( false, step2);
	} else {
		step2(global.settings.homey);
	}
	
	function step2( homey ){
				
		// get access token
		homey = _.findWhere(global.settings.me.homeys, { _id: homey._id });
		
		// POST the tmp file to Homey
		request.post({
			url: 'http://' + homey.ipInternal + '/api/manager/ledring/',
			headers: {
	    		'Authorization': 'Bearer ' + homey.token
			},
			json: animation
		}, function( err, data, response ){
			if( err ) return console.error(err);
			console.log(response);
		});
		
	}
	
}