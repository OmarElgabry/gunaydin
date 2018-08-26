'use strict';

const config 		= require('../config');
const passport 	= require('passport');
const logger 		= require('./logger');

const LocalStrategy 		= require('passport-local').Strategy;
const FacebookStrategy  = require('passport-facebook').Strategy;
const TwitterStrategy  	= require('passport-twitter').Strategy;

const User = require('../models/user');

/**
 * It encapsulates all code for authentication.
 * Authentication is either by using username and password, or by using social accounts.
 * 
 * @returns {Object} passport object
 */
module.exports = (function() {

	// serialize and deserialize user instances to and from the session.
	passport.serializeUser(function(userId, done) {
		User.findByIdAndUpdate(userId, { lastLogin: Date.now() });
		done(null, userId);
	});

	passport.deserializeUser(function(id, done) {
		User.findByIdAndSelect(id, '_id' , function (err, user) {
			done(err, user._id);
		});
	});

	// plug-in local strategy (username and password)
	passport.use(new LocalStrategy(
	  function(username, password, done) {
			User.findOneAndUpdate({ username: new RegExp(username, 'i'), socialId: null }, { lastLogin: Date.now() }, function(err, user) {
	      if (err) { return done(err); }

	      if (!user) {
	        return done(null, false, { message: 'Incorrect username or password.' });
	      }

	      user.validatePassword(password, function(err, isMatch) {
	        	if (err) { return done(err); }
	        	if (!isMatch){
	        		return done(null, false, { message: 'Incorrect username or password.' });
	        	}
	        	return done(null, user);
	      });

	    });
	  }
	));

	// In case of facebook, tokenA is the access token, while tokenB is the refersh token.
	// In case of twitter, tokenA is the token, whilet tokenB is the tokenSecret.
	var verifySocialAccount = function(tokenA, tokenB, data, done) {
		User.findOrCreate(data, function (err, user) {
	      	if (err) { return done(err); }
			return done(err, user); 
		});
	};

	// plug-in facebook & twitter Strategies
	passport.use(new FacebookStrategy(config.facebook, verifySocialAccount));
	passport.use(new TwitterStrategy(config.twitter, verifySocialAccount));

	return passport;
})();