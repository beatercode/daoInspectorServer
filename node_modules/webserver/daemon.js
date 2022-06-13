
// Copyright 2020 Sleepless Software Inc. All Rights Reserved

const path = require('path');
const fs = require('fs');

const socketio = require( "socket.io" );

const sleepless = require("sleepless");

const app = require('express')();

global.DEV = false;

if( process.argv.length < 3 ) {
	log( "Usage: node daemon.js root_dir [ port ]" );
	process.exit( 1 );
}


global.SITE = path.resolve( process.argv[ 2 ] || process.cwd() ); 
let PORT = toInt( process.argv[ 3 ] );


let cfg = require("./config.json");			// must exist - see config-example.json
cfg.store = require('greenlock-store-fs');


app.all( "*", ( req, res, next ) => {
	let mod = require( "./server.js" );
	mod( req, res, next );
});


let webd = null;

if( PORT > 0 ) {
	global.DEV = true;
	const http = require( "http" );
	webd = app.listen( PORT, () => {
		log( "DEV MODE: http listening on " + PORT + " & serving from " + SITE );
	});
}
else {
	cfg.agreeTos = true;
	cfg.approveDomains = function(opts, certs, cb) {
		cb( null, { options: opts, certs: certs } );
	};
	cfg.app = app;
	webd = require('greenlock-express').create(cfg).listen( 80, 443 );
	webd.on('listening', function() {
		log( "PRODUCTION MODE: " + webd.type + " listening on " + o2j( webd.address() ) );
	});
}

// --------------------------------------------


// websockets stuff

let seq = 829497;

const room = "sleepless";
const options = { };
//const io = socketio( 12346, options );
const io = socketio( webd );

io.on( "connection", socket => {

	let id = socket.client.id;
	seq += 1;
	let name = "Visitor-" + seq;
	log( "CONNECT: " + name + " id=" + id );

	socket.join( room );

	//io.to( room ).emit( "message", { type: "chat", from: "system", text: name + " has arrived." } );

	socket.emit( "message", { type: "welcome", name: name } );
	socket.emit( "message", { type: "chat", from: "system", text: "Welcome!" } );
	socket.emit( "message", { type: "chat", from: "system", text: "Your name is \"" + name + "\"" } );

	socket.on( "message", msg => {
		log("CHAT: " + name + ": " + msg);
		io.to( room ).emit( "message", { type: "chat", from: name, text: msg } );
	});

});

