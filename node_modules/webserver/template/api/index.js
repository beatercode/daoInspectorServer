delete require.cache[module.filename];	// force module reload on every request
'use strict'

require('sleepless').globalize();

const L = require( "log5" ).mkLog( "api: " )( 3 );
const colors = require( "colors" );

let api = function( req, res ) {

	let calls = ["log", "calls"];

	let body = req.body || {};
	body = j2o(body);

	let okay = function( act = "", data = "" ) {
		L.I(`\t${act} ▷ ${o2j(data)}`);
		res.writeHead(200, { 'Content-Type': 'application/json' });
    	res.end(o2j(data));
	}

	let fail = function( act = "", data = "" ) {
		L.E(`\t${act} ⧮ ${o2j(data)}`.red);
		res.writeHead(500, { 'Content-Type': 'application/json' });
		res.end(o2j(data));
	}

	let act = body?.act || null;
	if( act ) {

		if( act == "log" ) {
			// get msg
			let msg = body?.msg || null; 
			okay( act, msg );
			return;
		}

		if( act == "calls" ) {
			// get msg
			okay( act, calls );
			return;
		}

		fail( act, {error: `${act} is not a valid option`});
		return;
	} else {
		fail( "no act", {error: `no act`});
		return;
	}

}

module.exports = api;
