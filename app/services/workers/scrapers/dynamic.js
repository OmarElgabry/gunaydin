'use strict';

const Nightmare = require('nightmare')
const Scraper = require('./scraper');

var logger = require('../../../core/logger');

/**
 * Dynamic Scraper
 * 
 * Used for pages that rely on JavaScript.
 * It's built on top of nightmare (other options could be puppeteer).
 * 
*/
class DynamicScraperWorker extends Scraper {
  constructor() {
    super();
    const concurrency = 2;

    // initialize
    this.tabs = [], this.available = [];
    for(let j = 0; j < concurrency; j++) {
      this.tabs.push(this.getBrowser());
      this.available.push(true);
    }
  }

  async doWork (job) {
    var self = this;
    var { url, selectors, filters, lastId } = job;
    await Scraper.sleep();

    return new Promise(function (resolve, reject) {
      var tabI = self.getTab();
      if(!tabI && tabI !== 0) { 
        return reject('No tab available');
      }

      self.tabs[tabI]
      // .clearCache()
      .useragent(Scraper.userAgent())
      .header('Cache-Control', 'no-cache')
      .goto(url)
      .cookies.clearAll()
      .wait(selectors.waitFor)
      .evaluate(function(){
        return document.body.outerHTML;
      }).then(html => {
        self.releaseTab(tabI);
        resolve(Scraper.extract({ selectors, filters, lastId, html, url }));
      }).catch(err => {
        self.releaseTab(tabI);
        reject(err);
      })
    });
  }

  getTab() {
    for(let tabI = 0; tabI < this.available.length; tabI++) {
      if(this.available[tabI] === true) { 
        logger.info(`DynamicScraperWorker: Tab ${tabI} is busy.`);
        this.available[tabI] = false;
        return tabI;
      }
    }
    return null;
  }

  releaseTab(tabI) {
    logger.info(`DynamicScraperWorker: Tab ${tabI} is now available.`);
    this.tabs[tabI] = this.getBrowser();
    this.available[tabI] = true;
  }

  // TODO later on, proxy to server, and upstream 
  // instead of re-initializing instance every time.
  getBrowser() {
    return Nightmare({ 
      waitTimeout: Scraper.timeout(),   // default is 30 seconds 
      switches: { 'proxy-server': Scraper.proxy() },
      webPreferences: { images: false }
    })
  }
}

module.exports = DynamicScraperWorker;