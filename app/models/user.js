'use strict';

var userModel = require('../core/database').models.user;
const Template = require('../models/template');

// constants
const MAX_PAGE_LINKS = 50;
const MAX_PAGES = 10;
const LINKS_LIMIT = 10;

var create = function (data, callback){
	var newUser = new userModel(data);
	return newUser.save(callback);
};

var find = function (query, callback){
	return userModel.find(query, callback);
}

var findOne = function (query, callback){
	return userModel.findOne(query, callback);
}

var findOneAndUpdate = function (query, data, callback) {
	return userModel.findOneAndUpdate(query, data, callback);
}

var findById = function (id, callback){
	return userModel.findById(id, callback);
}

var findByIdAndSelect = function (id, select, callback){
	return userModel.findById(id, select, callback);
}

var findByIdAndUpdate = function(id, data, callback){
	return userModel.findByIdAndUpdate(id, data, { new: true }, callback);
}

/**
 * Find a user, and create one if doesn't exist already.
 * This method is used ONLY to find user accounts registered via Social Authentication.
 * 
 * @param {Object} profileFields - An object returned once the user is authenticated
 * @param {function} callback - A callback function
 */
var findOrCreate = function(profileFields, callback){
	findOneAndUpdate({ 'socialId': profileFields.id }, { lastLogin: Date.now() }, function(err, user){
		if(err) { return callback(err); }
		if(user){
			return callback(err, user);
		} else {
      // create a new user
			var userData = {
				username: profileFields.displayName,
        socialId: profileFields.id
			};

			// assign user profile picture 
			let picture = profileFields.photos[0].value || null;
			if (picture) { 
				userData.picture = picture;
				if(profileFields.provider == "facebook") {
					userData.picture = "http://graph.facebook.com/" + profileFields.id + "/picture?type=large";
				} else {
					userData.picture = userData.picture.replace('_normal', '');
				}
			}

			create(userData, function(err, newUser){
				callback(err, newUser);
			});
		}
	});
}

/**
 * Get all users in a shard (group)
 * 
 * @param {Number} shard - shard number
 * @param {function} callback - A callback function
 */
var getByShard = function(shard, callback) {
  return find({ shard: parseInt(shard) }, callback);
}

/**
 * Check if user is active or not.
 * User is inactive If the last time user logged in was > 7 days ago.
 * 
 * @param {Object} user - user object
 */
var isActive = function(user) {
	let lastLogin = (new Date).getTime() - user.lastLogin;
	return (lastLogin < 7 * 86400 * 1000);		// 7 days
}

/**
 * Can user update the page? No If:
 * - If page is muted.
 * - The page was updated recently.
 * 
 * @param {Object} userPage - user's page object
 * @returns {Boolean} 
 */
var canUpdatePage = async function(userPage) {
	if(userPage.muted) { return false; }

	try {
		let template = await Template.findById(userPage.templateId);
		let timeElapsed = (new Date).getTime() - userPage.lastUpdate;	
		return timeElapsed >= (template.updateInterval * 3600000);		// hour to ms
	} catch(err) {
		return false;
	}
}

/**
 * Get user data along with a page given it's index (array index).
 * 
 * @param {String} userId - user Id
 * @param {Number} pageIndex - page Index in array
 */
var getUserAndPage = function(userId, pageIndex) {
	return userModel.findById(userId, { 'pages' : { $slice : [pageIndex , 1] } } )
}

/**
 * Get user's page given it's index (array index).
 * We just fetch what we need about the page to be displayed 
 * 
 * @param {String} userId - user Id
 * @param {Number} pageIndex - page Index in array
 * @param {Number} offset - offset; used for pagination ('load more')
 */
var getPage = function(userId, pageIndex, offset = 0) {
	return userModel.findById(userId, {
		'pages' : { $slice : [pageIndex , 1] },
		'pages.title': 1,
		'pages.lastUpdate': 1,
		'pages.links': { $slice : [offset * LINKS_LIMIT , LINKS_LIMIT] },
	});
}

/**
 * To mute or unmute the page.
 * Muted pages will be skipped when we scrap.
 * 
 * 
 * @param {String} userId - user Id
 * @param {Number} pageIndex - page Index in array
 * @param {Boolean} muted - whether to mute or unmute a page
 */
var mutePage = function(userId, pageIndex, muted) {
	var $set = {};
	$set['pages.' + pageIndex + '.muted'] = muted;
	return userModel.findByIdAndUpdate(userId, { $set });
}

/**
 * Clear notifications.
 * New scrapped data will be counted as notifications.
 * Once the user views them, then will be cleared out.
 * 
 * @param {String} userId - user Id
 * @param {Number} pageIndex - page Index in array
 */
var clearNotifications = function(userId, pageIndex) {
	var $set = {};
	$set['pages.' + pageIndex + '.notifications'] = 0;
	return userModel.findByIdAndUpdate(userId, { $set });
}

/**
 * A middleware allows user to get access to pages ONLY if the user is already logged in.
 *
 */
var isAuthenticated = function (req, res, next) {
	if(req.isAuthenticated()){
		return next();
	} else {
		return res.redirect('/');
	}
}

module.exports = { 
	// constants
	MAX_PAGE_LINKS,
	MAX_PAGES,
	LINKS_LIMIT,

	// basic
	create, 
	find,
	findByIdAndSelect,
	findOne, 
	findOneAndUpdate,
	findById, 
	findOrCreate,
	findByIdAndUpdate,

	// 
	getByShard,
	isActive,
	canUpdatePage,
	getPage,
	getUserAndPage,
	mutePage,
	clearNotifications,

	// middleware
	isAuthenticated
};