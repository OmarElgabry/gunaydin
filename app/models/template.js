'use strict';

var cache = require('memory-cache');
const templateModel  = require('../core/database').models.template;

// constants
const CACHE_PREFIX = 'models_template_';

var create = function (data, callback){
	var newTemplate = new templateModel(data);
	return newTemplate.save(callback);
};

var find = function (query, callback){
	return templateModel.find(query, callback);
}

var findBySelect = function (query, select, callback){
	return templateModel.find(query, select, callback);
}

var findOne = function (query, callback){
	return templateModel.findOne(query, callback);
}

/**
 * Find a template by Id.
 * This method is likely to be called many times. 
 * So, we do cache the result.
 * 
 * @param	{String}		id - template Id
 * @param {function}	callback - callback function
 */
var findById = function (id, callback) {
	var key = CACHE_PREFIX + `findById_${id}`;
	var cached = cache.get(key);
	if(cached) {
		if(callback) { callback(null, cached); }
		return Promise.resolve(cached);
	}

	return templateModel.findById(id, function (err, template) {
		cache.put(key, template);
		if(callback) callback(err, template);
	});
}

var findByIdAndUpdate = function(id, data, callback){
	return templateModel.findByIdAndUpdate(id, data, { new: true }, callback);
}

module.exports = { 
	create, 
	find, 
	findBySelect,
	findOne, 
	findById, 
	findByIdAndUpdate
};