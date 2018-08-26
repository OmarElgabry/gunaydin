'use strict';

const request = require('request');
const Scraper = require('./scraper');

/**
 * Static Scraper
 * 
 * Used for static pages (no JavaScript needed).
 * 
*/
class StaticScraperWorker extends Scraper {
  constructor() {
    super();
  }

  async doWork (job) {
    var self = this;
    var { url, selectors, filters, lastId } = job;
    await Scraper.sleep();

    return new Promise(function (resolve, reject) {
      request({ 
        url, 
        timeout: Scraper.timeout(),   // default is 120000 (2 min)
        proxy: Scraper.proxy(),
        headers: { 'User-Agent': Scraper.userAgent(), 'Cache-Control': 'no-cache' } /*, 'Cookie': '' },
        jar: true*/
      }, function (err, response, html) {
        if (!err && response.statusCode == 200) {
          resolve(Scraper.extract({ selectors, filters, lastId, html, url }));
        } else {
          reject({ err, response });
        }
      });
    });
  }
}

module.exports = StaticScraperWorker;