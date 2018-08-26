'use strict';

const Scraper = require('./scrapers/scraper');
const User = require('../../models/user');

/**
 * Page Worker
 * 
 * Saves user's pages (new links) to database (after scraping)
 * 
*/
class PageWorker extends Scraper {
  constructor() {
    super();
  }

  async doWork (job) {
    // var { user, pI } = job;
    var { userId, pages } = job;

    if(!pages.length) { return Promise.resolve(true); }
    
    var $set = {};
    pages.forEach(page => {  $set['pages.' + page.pI] = page.doc; });
    return User.findByIdAndUpdate(userId, { $set });

    // if(pI) {
    //   $set['pages.' + pI] = user.pages[0];
    //   return User.findByIdAndUpdate(user._id, { $set });
    // } else {
    //   return user.save();
    // }
  }
}

module.exports = PageWorker;