var _			= require('underscore');
var inquirer	= require("inquirer");

module.exports.select = function( save, callback ){
	
	global.lib.user.refresh(function(){
		var homeys = global.settings.me.homeys;
			
		// generate list of choices
		var choices = [];
		homeys.forEach(function(homey){
			choices.push({
				value: homey._id,
				name: homey.name + ' @ ' + homey.ipInternal
			});
		});
		
		// ask
		inquirer.prompt([
			{
				type: "list",
				name: "homey",
				message: "Select active Homey",
				choices: choices
			}
		], function(answers){
			
			// show which homey is active
			var activeHomey = _.findWhere(homeys, { _id: answers.homey });
			delete activeHomey.users;
			
			if( save ) {
				// save
				global.settings.homey = activeHomey;
			
				// give feedback
				console.log("Saved active Homey: " + activeHomey.name );
			} else {
				if( typeof callback == 'function' ){
					callback(activeHomey);
				}
			}
		});
	});
	
}

module.exports.unselect = function(){
	var active = global.settings.homey;
	
	if( typeof active == 'undefined' ) {
		console.log('there was no active homey');
	} else {
		delete global.settings.homey;
		console.log('unselected homey `' + active.name + '`');
	}
}

module.exports.list = function(){
	
	console.log("");
	console.log("Your Homeys:");
	console.log("");
	
	global.lib.user.refresh(function(){
		
		var homeys = global.settings.me.homeys;
	
		homeys.forEach(function(homey, i){
			
			var me = _.findWhere(homey.users, { user: global.settings.me._id });
			
			console.log('-------------------------------------');
			console.log(' name:      ' 	+ homey.name);
			console.log(' id:        '	+ homey._id);
			console.log(' lan ip:    ' 	+ homey.ipInternal);
			console.log(' wan ip:    ' 	+ homey.ipExternal);
			console.log(' my role:   ' 	+ homey.role);
			console.log(' my token:  ' 	+ homey.token); // TOFIX by joachim
			console.log(' # users:   ' 	+ homey.users.length);
			
			if( i == homeys.length-1 ) {
				console.log('-------------------------------------');
			}
		})
	
	})
}