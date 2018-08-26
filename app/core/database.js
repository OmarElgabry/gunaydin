'use strict';

const config 		= require('../config');
const logger 		= require('./logger');
var Mongoose 	= require('mongoose');

// -------------- connect to the database --------------
// construct the database uri and encode username and password.
var dbconfig = config.mongodb;
var uri = "mongodb://" +
			encodeURIComponent(dbconfig.username) + ":" +
			encodeURIComponent(dbconfig.password) + "@" +
			dbconfig.host + ":" +
			dbconfig.port + "/" +
			dbconfig.dbname + ((dbconfig.ssl)? "?ssl=true": "");
Mongoose.connect(uri, { useNewUrlParser: true });

// throw an error if the connection fails
Mongoose.connection.on('error', function(err) {
	if(err) throw err;
});

// override Mongoose promise
Mongoose.Promise = global.Promise;

// -------------- define models(s) --------------
var schemas = require('./schemas');
var models = {};
Object.keys(schemas).forEach(schema => {
	models[schema] = Mongoose.model(schema, schemas[schema]);
});

module.exports = {
	models
};