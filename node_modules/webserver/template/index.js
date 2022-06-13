delete require.cache[module.filename];	// force module reload on every request
'use strict'

const L = require( "log5" ).mkLog( "router: " )( 4 );
const colors = require( "colors" );

let router = function( req, res, cb ) {
	if( req?.url != "/reload.js" ) { 
		L.V( `\t${req.url}` ); 
	} else {
		L.D( `\t${req.url}` );
	}

	if ( req.url.startsWith("/api") ) {
		let mod = mod_load( __dirname + "/api" );
		if( mod ) {
			L.W("\tapi module loaded ");
		   	mod( req, res );
		} else {
			L.E("\tmod not found");
		}
		res.end();
		return;
	} else {
		req.url = `static/${req.url}`;
		cb( req, res );
	}

}

module.exports = router;
