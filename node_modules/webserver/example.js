
let argv = process.argv;

let email = argv[ 2 ];
let domains = argv[ 3 ].split( "," );

// create a simple express app that returns index.html for all requests
express = require( "express" );
app = express();
app.use(function( req, res, next ) {
	let html = require("fs").readFileSync( "./index.html", "utf8" );
	res.setHeader( "Content-Type", "text/html; charset=utf-8" );
	res.end( html );
});


// This function handles incoming websocket connections
let ws = function( socket, req ) {
	socket.send( "A socket connection has come in.  Welcome, client!  I'll be your server today." );
	socket.on( "message", function( data ) {
		socket.send( "Hey client, thanks for the message: " + data );	
	});
}


// create our cool webserver
let webserver = require( "./webserver.js" );
webserver({
	http_handler: app,		// Required
	websocket_handler: ws,	// Required
	email,					// required
	domains,				// Required
	staging: false,			// Optional. Defaults to "true". Change to "false" for production.
});


