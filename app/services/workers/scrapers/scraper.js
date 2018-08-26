'use strict';

const _eval = require('eval');
const cheerio = require('cheerio');

const logger = require('../../../core/logger');
const Utils = require('../../../core/utils');

const Worker = require('../worker');
const settings = require('./settings.json');

const USER_AGENTS = settings.userAgents;
var PROXIES   = settings.proxies;
var PROXY_ID  = 0;

/**
 * Scraper
 * 
 * Defines common methods to be inherited by scraper objects.
 * It inherits from Worker.
 * 
 * @see Worker
*/
class Scraper extends Worker {
  constructor() {
    super();
  }

  /**
   * Executes a given script
   * 
   * @see extract()
  */
  static eval(script, args) {
    if(!script) { return ''; }

    try {
      return _eval(`exports._ = ${script}`, args)._;
    } catch(err) {
      logger.error(`Scraping eval error script: ${script}`, err);
    }
  }

  /**
   * Extracts data from html
   * 
   * @see TemplateSchema
  */
  static extract(data) {
    var { selectors, filters, lastId, html, url } = data;
    if(!html) { return []; }

    var $ = cheerio.load(html);
    var self = this, links = [], exist = false;
    $(selectors.list).each(function(i, ele) {
      var link = {};
      var item = $(ele);
      exist = true;

      Object.keys(selectors).forEach(key => {
        if(key === 'list' || key === 'waitFor') { return; }
        link[key] = self.eval(selectors[key], { item }); 
        if(!link[key]) delete link[key];
      });
            
      // if no new links, then break.
      // if not valid (missing data or filters don't match), then skip
      if(lastId && lastId === link.id) { 
        return false;
      } else if(!self.valid(link, filters)) { 
        return true;
      }

      links.push(self.format(link));
    });

    // check potential changes in HTML DOM
    if(!exist) { logger.warn(`Scraper: Failed to extract the list for ${url}`); }

    return links;
  }
  
  static valid(link, filters) {
    // missing required values
    if(!link.id || !link.url || !link.title) { return false; }

    // filters
    if(!filters) { return true;}
    if(filters.contains) {
      return link.title && link.title.indexOf(filters.contains) >= 0;
    }

    return true;
  }

  static format(link) {
    // title
    link['title'] = link['title'].trim();

    // content
    if(link['content']) { 
      link['content'] = link['content'].trim().replace(/(\t|\n|\s{2,})/g, '');
    }

    // date (when link was scraped and NOT created)
    link['date'] = Date.now();

    delete link['$init'];
    return link;
  }

  // ------------ Proxies and User Agents ------------
  /**
   * Randomly assign a user agent
  */
  static userAgent() {
    var ran = Math.floor(Math.random() * USER_AGENTS.length);
    return USER_AGENTS[ran];
  }

  /**
   * Get a proxy by Round-robin.
  */
  static proxy() {
    PROXY_ID = (++PROXY_ID) % PROXIES.length;
    return  'http://' + PROXIES[PROXY_ID];
  }

  static hasProxies() {
    return PROXIES.length > 5;    // threshold
  }

  static shuffleProxies(){
    Utils.shuffle(PROXIES);
    PROXY_ID = 0;
  }

  static updateProxies(proxies) {
    if(!proxies || proxies.constructor !== Array) {
      return;
    } else if(!proxies.length) {
      logger.warn(`updateProxies: Proxies couldn't be found.`);
    } else {
      logger.info(`updateProxies: Found new ${proxies.length} proxies`);
      PROXIES = proxies.concat(PROXIES).slice(0, 100);    // max number of proxies
      PROXY_ID = 0;
    }
  }

  // random delays
  static sleep() {
    var ms = Math.floor(Math.random() * 100);
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // request timeout
  static timeout() {
    return 20 * 1000;
  }
}

module.exports = Scraper;