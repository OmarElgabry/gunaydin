'use strict';

var session = require('express-session');

/**
 * Initialize session
 * Session is saved in user's broswer.
 */
module.exports = (function () {
  return session({
    name: 'gunaydin',
    secret: Math.random().toString(36).substring(7),
    resave: false,
    saveUninitialized: false,
    unset: 'destroy',
  });
})();