'use strict';

var winston = require('winston');
var config  = require('../config');

/**
 * Creates a loggly transport object.
 * Using loggly is one of the options to ship our logs 
 * So we can filter and query them, with it's nice, easy-to-use dashboard. 
 * It has a free plan.
 * 
 * @returns {Object} loggly	winston transport 
 */
function _loggly() {
  require('winston-loggly-bulk');
  return new (winston.transports.Loggly)({
    level: 'warn',
    handleExceptions: true,
    token: config.loggly.token,
    subdomain: config.loggly.subdomain,
    tags: ["Winston-NodeJS"],
    json: true
  });
}

/**
 * Creates console transport object
 * 
 * @returns {Object} console winston transport
 */
function _console() {
  return new (winston.transports.Console)({
    level: 'debug',
    // json: true,
    handleExceptions: true,
    humanReadableUnhandledException: true
  })
}

/**
 * Returns an array of transports
 * 
 * @returns {Array} array of transports to log to
 */
function getTransports() {
  var transports = [];

  Object.keys(config.logging.enable).forEach(transport => {
    if(!config.logging.enable[transport]) { return; }

    if(transport === 'loggly') { transports.push(_loggly()); }
    else if(transport === 'console') { transports.push(_console()); }
  });

  return transports;
}

// create winston object 
var logger = new (winston.Logger)({
	transports: getTransports(),
	exitOnError: true
});

// -------- Custom Logger (loggly) --------
// Here we extend the winston object to customize the log functions.
// For example, we populate the request url and user with every log
var loggly = {
  meta: {},
  propagateRequest: function(req, res, next) {
    loggly.meta.requestUrl = req.originalUrl;

    // make sure to clear the user if not defined!
    loggly.meta.user = (req.user)? req.user.username: undefined;  

    next();
  },
  log: function(level, message, meta) {
    logger.log(level, message, meta);
  },
  query: function(options, callback) {
    logger.query(options, callback);
  }
};

// dynamically assign level functions 
var levels = { error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 };
Object.keys(levels).forEach(level => {
  loggly[level] = function(message, meta) {
    if(meta && meta.constructor !== Object) { 
      meta = meta.toString();
    }

    meta = Object.assign(meta || {}, loggly.meta);
    loggly.log(level, message, meta);
  }
});

module.exports = loggly;