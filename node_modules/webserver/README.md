
# WebServer

Copyright 2020 Sleepless Software Inc.  All Rights Reserved.

A simple web server with auto reloading


## Install

	npm i -g webserver


## Usage

Serve static files from a directory:

	webserver port directory


## Framework Style Usage 

Create an app dir:ectory

	webserver create path/to/myapp

Run the app:

	webserver run 3000 path/to/myapp


## Experimental

To auto reload when files change (your app has to support this)

	webserver run 3000 path/to/myapp true


