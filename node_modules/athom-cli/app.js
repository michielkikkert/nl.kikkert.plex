#!/usr/bin/env node

var fs			= require('fs');
var path		= require('path');

var program		= require('commander');
var colors		= require('colors');

var lib = global.lib = {
	settings	: require('./lib/settings'),
	user		: require('./lib/user'),
	api			: require('./lib/api'),
	homey		: require('./lib/homey'),
	project		: require('./lib/project'),
	ledring		: require('./lib/ledring')
}
 
var pjson = require( path.join(__dirname, 'package.json') );

program
	.version(pjson.version)
	
program
	.command('login')
	.description('login to your Athom account')
	.action(function(){
		lib.user.login(function(){
			setTimeout(process.exit, 1000);
		});
	})
	
program
	.command('logout')
	.description('logout of your Athom account')
	.action(lib.user.logout)

program
	.command('project')
	.description('run `athom project --help` to view homey commands')
	.option('--create [path]', "create a new Homey app")
	.option('--run [path]', "run a Homey app")
	.option('--validate [path]', "validate a Homey app")
	.option('--validate-app-store [path]', "validate a Homey app")
	.action(function(options){
		if( options.create )					lib.project.create(options.create);
		if( options.run )						lib.project.run(options.run);
		if( options.validate )					lib.project.validate(options.validate);
		if( options.validateAppStore )			lib.project.validateAppStore(options.validateAppStore);
	})
	
program
	.command('homey')
	.description('run `athom homey --help` to view homey commands')
	.option('--list', 'list your Homeys')
	.option('--select', 'select active Homey')
	.option('--unselect', 'clear active Homey')
	.action(function(options){
		if( options.list )		lib.homey.list();
		if( options.select )	lib.homey.select(true);
		if( options.unselect )	lib.homey.unselect();
	})
	
program
	.command('ledring')
	.description('run `athom ledring --help` to view homey commands')
	.option('--run [path]', "run a ledring animation app")
	.action(function(options){
		if( options.run )		lib.ledring.run(options.run);
	})
	
program
	.parse(process.argv);
	
if (!process.argv.slice(2).length) {
	program.outputHelp();
}