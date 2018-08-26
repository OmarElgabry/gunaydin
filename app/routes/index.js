'use strict';

var express	 	= require('express');
var router 		= express.Router();
var passport 	= require('passport');

const logger = require('../core/logger');
const User = require('../models/user');
const UserService = require('../services/user');
const Template = require('../models/template');

/* --------------------- Login --------------------- */
router.get('/', function(req, res, next) {
	// If user is already logged in, then redirect to rooms page
	if(req.isAuthenticated()){
		res.redirect('/home');
	} else {
		res.render('login', {
			success: req.flash('success')[0],
			errors: req.flash('error'), 
			showRegisterForm: req.flash('showRegisterForm')[0]
		});
	}
});

// login
router.post('/login', passport.authenticate('local', { 
	successRedirect: '/home', 
	failureRedirect: '/',
	failureFlash: true
}));

// register via username and password
router.post('/register', function(req, res, next) {
	var credentials = { 'username': req.body.username, 'password': req.body.password };

	if(credentials.username === '' || credentials.password === '') {
		req.flash('error', 'Missing credentials');
		req.flash('showRegisterForm', true);
		res.redirect('/');
	} else {
		// check if the username already exists for non-social account
		User.findOne({
			'username': new RegExp('^' + req.body.username + '$', 'i'), 
			'socialId': null }, 
		function(err, user) { 
			if(err) throw err;
			if(user) {
				req.flash('error', 'Username already exists.');
				req.flash('showRegisterForm', true);
				res.redirect('/');
			} else {
				User.create(credentials, function(err, newUser){
					if(err) throw err;
					req.flash('success', 'Your account has been created. Please log in.');
					res.redirect('/');
				});
			}
		});
	}
});

// social authentication routes
// via facebook
router.get('/auth/facebook', passport.authenticate('facebook'));
router.get('/auth/facebook/callback', passport.authenticate('facebook', {
		successRedirect: '/home',
		failureRedirect: '/',
		failureFlash: true
}));

// via twitter
router.get('/auth/twitter', passport.authenticate('twitter'));
router.get('/auth/twitter/callback', passport.authenticate('twitter', {
		successRedirect: '/home',
		failureRedirect: '/',
		failureFlash: true
}));

// logout
router.get('/logout', function(req, res, next) {
	// remove the req.user property and clear the login session
	req.logout();

	// destroy session data
	req.session = null;

	// redirect to homepage
	res.redirect('/');
});

/* --------------------- Home --------------------- */
router.get('/home', User.isAuthenticated, function(req, res, next) {
	UserService.home(req.user)
	.then(result => {
		let { userAndPages, links } = result;

		res.render('index', { 
			pages: userAndPages.pages,
			links,
			user: { username: userAndPages.username, picture: userAndPages.picture }
		});
	}).catch(err => {
		logger.error(`Couldnt display user's home user: ${req.user}`, err);
		return res.status(500).sendFile(process.cwd() + '/app/views/500.htm');
	})
});

// load templates
router.get('/templates', User.isAuthenticated, function(req, res, next) {
	Template.findBySelect({}, 'name sampleUrls regex')
	.then((templates) => {
		res.send(templates); 
	}).catch(err => {
		next(err);
	})
});

/* --------------------- Page --------------------- */
// get user's page
router.get('/user/page/:pI', User.isAuthenticated, function(req, res, next) {
	let pI = parseInt(req.params.pI);
	let offset = req.query.offset || 0;
	UserService.getPage(req.user, pI, offset)
	.then(user => {
		if(offset === 0) { UserService.clearNotifications(req.user, pI);	}		// cheat
		return res.send(user.pages[0]);
	}).catch(err => {
		next(err);
	})
});

// add page
router.post('/user/page', User.isAuthenticated, function(req, res, next) {
	var page = req.body;

	// missing values
	if(!page.templateId || !page.pageUrl || !page.title) {
		return res.send({ error: 'Missing values!' });
	}

	UserService.addPage(req.user, page)	
	.then(result => {
		if(result && result.error) { 
			return res.send({ error: result.error });
		} else { res.send({ success: true }); }
	}).catch(err => {
		next(err);
	});
});

// refresh
router.get('/user/page/:pI/refresh', User.isAuthenticated, function(req, res, next) {
	var pI = parseInt(req.params.pI);
	UserService.refresh(req.user, pI)
	.then((result) => {
		if(result && result.error) { 
			return res.send({ error: result.error });
		} else { res.send({ success: true, message: 'The page will be updated shortly.' }); }
	}).catch(err => {
		next(err);
	})
});

// (un)mute page
router.put('/user/page', User.isAuthenticated, function(req, res, next) {
	var pI = parseInt(req.body.pI);
	var muted = req.body.muted;

	UserService.mutePage(req.user, pI, muted)
	.then(() => {
		res.send({ success: true });
	}).catch(err => {
		next(err);
	})
});

// delete
router.delete('/user/page/:pI', User.isAuthenticated, function(req, res, next) {
	var pI = parseInt(req.params.pI);
	UserService.delete(req.user, pI)
	.then((result) => {
		if(result.error) { 
			return res.send({ error: result.error });
		} else { res.send({ success: true }); }
	}).catch(err => {
		next(err);
	})
});

/* --------------------- Votes --------------------- */
// NOTE: Votes is not used till now. But, later on, It can be considered.
// add vote link
router.post('/user/votes', User.isAuthenticated, function(req, res, next) {
	let vote = req.body;

	// missing values
	if(!vote.title || !vote.url) {
		return res.send({ error: 'Missing values!' });
	}

	// validate url @see https://stackoverflow.com/a/15855457
	var valid = /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i.test(vote.url);
	if(!valid) {
		return res.send({ error: 'URL is invalid!' });
	}

	UserService.addVote(vote)
	.then(() => {
		res.send({ success: true, message: 'Vote has been created.' });
	}).catch(err => {
		next(err);
	});
});

router.post('/user/votes/vote', User.isAuthenticated, function(req, res, next) {
	UserService.vote(req.user, req.body);		// vote: { id, up/down }
	res.send({ success: true });		// cheat
});

module.exports = router;