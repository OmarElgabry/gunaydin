'use strict';

const cheerio = require('cheerio');
const Nightmare = require('nightmare');
const Scraper = require('./scraper');

var logger = require('../../../core/logger');

/**
 * Proxy Scraper
 * 
 * Used to get a list of proxies to used when scraping.
 * 
*/
class ProxyScraperWorker extends Scraper {
  constructor() {
    super();
  }

  static construct() {
    ProxyScraperWorker.nightmare = Nightmare({ 
      waitTimeout: Scraper.timeout(),
      // switches: { 'proxy-server': Scraper.proxy() },
    });
  }

  doWork (job) {
    var self = this;
    
    return new Promise(function (resolve, reject) {
      ProxyScraperWorker.nightmare
      .useragent(Scraper.userAgent())
      .header('Cache-Control', 'no-cache')
      .goto("http://spys.one/en/https-ssl-proxy/")
      .cookies.clearAll()
      .select('#xpp', '5')    // number of proxies = 500
      .select('#xf1', '1')    // anonymous proxy server & high anonymous proxy
      .wait(5000)     // can't determine what ele to wait for, so just put 5secs
      .evaluate(function(){ return document.body.outerHTML; })
      .then(html => {
        var $ = cheerio.load(html);
        var proxies = [];
        $('body > table:nth-child(3) > tbody > tr:nth-child(4) > td > table > tbody > tr')
        .each(function(i, ele) {
          var proxy = $(ele).find('td:nth-child(1) > font.spy14').remove('.spy2, script').text();
          var speed = parseFloat($(ele).find('td:nth-child(6) > font').text());
          if(proxy && speed && speed <= 0.4) { proxies.push(proxy); }
        });

        Scraper.updateProxies(proxies);
        resolve(proxies);    
      }).catch(err => {
        reject(err);
      })
    });
  }
}

ProxyScraperWorker.construct();
module.exports = ProxyScraperWorker;