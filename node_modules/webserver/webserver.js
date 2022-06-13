"use strict";

// Copyright 2020
// Sleepless Software Inc.
// All Rights Reserved
// sleepless.com

const sleepless = require("sleepless");

module.exports = function( opts ) {

	// add defaults for those attributes in opts that aren't provided
	let def_opts = {
		packageRoot: ".",
		configDir: "./greenlock.d",
		cluster: false,
		staging: true,
		websocket_handler: function(){},
		notify: function(){},
	}
	for( let k in def_opts ) {
		if( opts[ k ] === undefined ) {
			opts[ k ] = def_opts[ k ];
		}
	}

	throwIf( ! opts.email, "The 'email' attribute required in options" );
	throwIf( ! opts.domains, "The 'domains' attribute required in options" );

	opts.maintainerEmail = opts.email;

	let domains = opts.domains;
	let p = opts.configDir + "/config.json";
	let DS = require("ds").DS;
	let ds = new DS( p );
	ds.sites = [ { subject: domains[ 0 ], altnames: domains } ];
	ds.save();

	require("greenlock-express")
	.init( opts )
	.ready( function( glx ) {

		let server = glx.httpsServer();

		let WebSocket = require( "ws" );
		let wss = new WebSocket.Server( { server } );
		wss.on( "connection", opts.websocket_handler ); 

		glx.serveApp( opts.http_handler );

	});
}

