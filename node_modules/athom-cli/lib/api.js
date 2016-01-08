var request			= require('request');
var _				= require('underscore');

var apiUrl = 'https://api.athom.com/';

module.exports = function call( options, callback ) {
	
	// create the options object
	options = _.extend({
		path			: '/',
		method			: 'GET',
		access_token	: global.settings.accessToken,
		refresh_token	: global.settings.refreshToken,
		json			: true
	}, options);
	
	// remove the first trailing slash, to prevent `.nl//foo`
	if( options.path.charAt(0) === '/' ) path = options.path.substring(1);
	
	// make the request
	request({
		method	: options.method,
		url		: apiUrl + path,
		json	: options.json,
		headers	: {
			'Authorization': 'Bearer ' + options.access_token
		}
	}, function( err, response, body ){
				
		if( err ) return callback( err );
		
		if( response.statusCode == 400 || response.statusCode == 401 ) {			
			return request({
				url: 'https://my.athom.com/auth/refresh?refresh_token=' + options.refresh_token,
				json: true
			}, function( err, result, body ){				
				if( body.accessToken ) {
					
					// save the new token
					global.settings.accessToken = body.accessToken;
					
					// retry			
					options.access_token = body.accessToken;
					global.lib.api( options, callback );
					
				}
				
			});
		}
		
		if( typeof callback == 'function' ) {
			callback( null, response, body );
		}
		
	});
	
}