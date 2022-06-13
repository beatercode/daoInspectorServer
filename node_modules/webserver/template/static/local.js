'use strict';

function server_log( txt ) { rpc({ act: "log", msg: txt }); }

document.addEventListener( "DOMContentLoaded", dcl => {
	sleepless.globalize();
	let s = rplc8("#sleep");
	s.update( Object.keys(sleepless).map( sa => { return { key: sa } }));

	server_log("ping", res => {
		console.log( "res:", res );
	})
	checkReload();
	document.querySelector( "#okay" ).addEventListener( "click", e => {
		let ok = confirm("Okay?");
		if( ok ) alert("Okay. Okay. Okay.");
	});

	let c = rplc8("#calls");
	rpc({ act: "calls" }, calls => {
		if( ! calls ) { return; }
		c.update(calls.map(ca => { return { key: ca }}));
	})

	rpc({act:"dummy"});
});

let old_reload = null, reload_script = null;
function checkReload( cb ) {
	if( reload_script ) reload_script.remove();
    reload_script = document.createElement( "script" );
    if ( cb ) reload_script.onload = cb( reload_script );
    reload_script.src = "reload.js";
    document.body.appendChild( reload_script );
	setTimeout( () => {
		checkReload( s => {
			if( !old_reload ) old_reload = globalThis.needs_reload;
			if( old_reload != globalThis.needs_reload ) { window.location.reload(); }
			old_reload = globalThis.needs_reload;
		});
	}, 1000);
}

function rpc( o = { act: "log", msg: "empty request"}, cb ) {
	o = o2j(o);
    var client = new XMLHttpRequest();
    client.onreadystatechange = function() {
		if( ! cb ) { return; }
		cb( j2o(this.responseText) );
    };
    client.open("POST", "/api", true);
    client.setRequestHeader("Content-Type", "application/json");
    client.send(o);
}