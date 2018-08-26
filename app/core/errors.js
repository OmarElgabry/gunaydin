'use strict';

const express = require('express');
const router = express.Router();

const logger = require('../core/logger');

// handle errors
// catch 404 errors
router.use(function(req, res, next) {
	return res.status(404).sendFile(process.cwd() + '/app/views/404.htm');
});

// express middleware to handle errors from the routes (caught and uncaught exceptions)
// caught expcetions should go to: next(err)
router.use((err, req, res, next) => {
	logger.error(err.message, err);
	return res.status(500).send({ 
		code: 500, 
		error: 'We are facing an internal error. Please try again later.' 
	});
});

process.on('unhandledRejection', (ex) => {
	// a trick to delegate the unhandled promise rejections to winston
	throw ex;
});


module.exports = router;