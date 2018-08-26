'use strict';

const config = require('../config');
const logger = require('../core/logger');

const QueueFactory = require('./queue/factory');
const User = require('../models/user');
const Template = require('../models/template');
const Stats  = require('./stats');
const Scraper = require('./workers/scrapers/scraper');
const Utils = require('../core/utils');

// constants
const SCRAP_INTERVAL = 1800000;   // 30 min
const BUFFER = 300000;            // 5 min
const UPDATE_INTERVAL = 600000;   // 10 min
const SHARD_CYCLE_INTERVAL = SCRAP_INTERVAL + (BUFFER * 2) + UPDATE_INTERVAL;

const PROXY_UPDATE_INTERVAL = 3600 * 1000;  // 1 hour

/**
 * Scheduler
 * 
 * All the work to be done every time interval.
 * - Scraping
 * - Saving scrapped data to database.
 * - Etc. 
 * 
*/
class SchedulerService {
  constructor() {
  }

  // start
  static start () {       
    // initialize queues
    SchedulerService.staticScraperQueue  = QueueFactory.getQueue('staticScraper');
    SchedulerService.dynamicScraperQueue = QueueFactory.getQueue('dynamicScraper');
    SchedulerService.proxyScraperQueue   = QueueFactory.getQueue('proxyScraper');
    SchedulerService.pageQueue = QueueFactory.getQueue('page');

    // get proxies, and then start the scheduler
    SchedulerService.proxies()
    .then(() => { SchedulerService.scheduler(); })
    .catch(err => { throw err; });
  }

  // get proxies that will be used in scraping
  static proxies() {
    var self = SchedulerService;

    return new Promise(async (resolve, reject) => {
      var resolved = false;
      self.proxyScraperQueue.push({}, () => { 
        resolve(true);
      });

      // reject if not resolved after timeout
      setTimeout(() => { 
        if(!resolved && !Scraper.hasProxies()) { 
          reject(`Couldn't load initial proxies within timeout.`);
        }
      }, 30 * 1000);
    });
  }

  /**
   * This method is the backbone of the application.
   * It's the starting point where all the scraping kicks in (after the getting the proxies).
   * 
   * Users are split-ed among cyles (= number of shards). Each cycle has 4 phases: 
   *  Scraping, buffer, Saving to database, buffer
   * 
   * So, the reason why users are splitted into cycles (shards),
   *  is to scrap each shard every interval of time (SHARD_CYCLE_INTERVAL).
   * 
   */
  static scheduler () {
    var self = SchedulerService;

    // what happens in every cycle
    function shardCycle() {
      // initial state
      self.InitState();
      Scraper.shuffleProxies();

      // scrapping state
      // 1. fetch user page links (estimated to take SCRAP_INTERVAL ms)
      self.ScrapingState();
      self.scrap();

      // 2. buffer
      // BUFFER time  ...
      
      // update state
      // 3. update (estimated to take UPDATE_INTERVAL ms)
      setTimeout(function(){
        self.UpdateState(); 
        self.update();
      }, SCRAP_INTERVAL + BUFFER);

      // 4. buffer
      // BUFFER time ...
    }

    // update proxy every PROXY_UPDATE_INTERVAL
    function proxyUpdate() {
      SchedulerService.proxies().catch(err => {
        logger.warn('Couldnt update proxy', err);
      });
    }

    // define intervals
    setTimeout(shardCycle, 0);
    setInterval(function(){
      // log the stats
      Stats.log(SchedulerService.state.shard);
      // then, start another cycle
      shardCycle();
    }, SHARD_CYCLE_INTERVAL);
    setInterval(proxyUpdate, PROXY_UPDATE_INTERVAL);
  }

  // ---------- Scheduled Jobs ----------
  /**
   * Scrap users' pages.
   * 1) First get all users in a shard. 
   * 2) Loop through each user's page.
   * 3) Do scrap it (unless otherwise - see conditions below)
   * 
   */
  static scrap() {
    var shard = SchedulerService.state.shard;

    User.getByShard(shard, (err, users) => {
      if(err) { 
        logger.error(`Failed to load users in shard ${shard}`, err);
        return;
      }
      
      // shuffle and then update current users 
      // shuffling is useful when scraping; avoding same pattern
      Utils.shuffle(users);
      SchedulerService.state.users = users;
      
      // for each user in the shard
      logger.info(`Scrap: Start shard: ${shard} and has users: ${users.length}`);
      for(let uI = 0; uI < users.length; uI++) {

        // don't proceed if user is inactive
        if(!User.isActive(users[uI])) { continue; }
        
        // for each users' pages
        let userPages = users[uI].pages;

        for(let pI = 0; pI < userPages.length; pI++) {
          // don't proceed if user's page has been updated recently or muted     
          if(! (await (User.canUpdatePage(userPage)))) { continue; }

          // send job to be processed
          SchedulerService.sendScrapJob({ uI, pI, userPage: userPages[pI] });
        }
      }
    });
  }

  /**
   * Update user pages after scraping is done (If new links are found).
   * This is done once per user object.
   * 
   */
  static update() {
    let users = SchedulerService.state.users;
    for(let uI = 0; uI < users.length; uI++) {
      let user = users[uI];
      let pagesToUpdate = [];     // {pI, page} 
      user.pages.forEach((page, pI) => {
        if(!page.updated) { return; }
        pagesToUpdate.push({ pI, doc: page });
      });

      if(!pagesToUpdate.length) { continue; }

      logger.info(`Update Pages: Updating ${pagesToUpdate.length} pages for user ${user.username}`);
      SchedulerService.pageQueue.push({ userId: user._id.toString(), pages: pagesToUpdate, scheduled: true });
    }
  }

  // ---------- Scraping Jobs ----------
  /**
   * Send a scraping job to the queue.
   * 
   */
  static async sendScrapJob({ uI, pI, userPage }) {
    if(!SchedulerService.state.isScraping) { return; }

    try {
      let user = SchedulerService.state.users[uI];
      var template = await SchedulerService.getTemplate(userPage.templateId, user.username);
      if(!template) { return; }

      // create a job 
      let job = SchedulerService.createJob({ uI, pI, userPage, template });
      let scraperQueue = SchedulerService.getScraperQueue(template.dynamic);
        
      scraperQueue.push(job, (response) => { SchedulerService.onScrapJobDone(response); });    
    } catch(err) {
      logger.error(`sendScrapJob: An error while sending scrap job.`, err);
    }
  }

  /**
   * A callback to be executed when the job is done successfuly
   * 
   */
  static onScrapJobDone(response) {
    var { data: newLinks, uI, pI, shard, jobId } = response;

    // The callback might be called while not in scraping phase or at later cycles (because of delay) 
    if(!SchedulerService.state.isScraping || SchedulerService.state.shard !== shard) {
      logger.warn(`onScrapJobDone: A job ${jobId} is done but delayed. Job cycle: ${shard}, current cycle: ${SchedulerService.state.shard}`);
      Stats.jobDelayed();
      return;
    }

    // update
    let user = SchedulerService.state.users[uI];
    SchedulerService.updatePage(user.pages[pI], newLinks, user.username);
  }

  // ---------- Events ----------
  /**
   * Refresh a user's page. It's on-demand scraping.
   * 
   */
  static async refresh (user, pI, userPage) {
    var template = await SchedulerService.getTemplate(userPage.templateId, user.username);
    if(!template) { return; }

    // userId instead of uI (;userIndex)
    let job = SchedulerService.createJob({ uI: user._id.toString(), pI, userPage, template, scheduled: false });
    let scraperQueue = SchedulerService.getScraperQueue(template.dynamic);

    scraperQueue.push(job, (response) => { 
      var newLinks = response.data;

      SchedulerService.updatePage(userPage, newLinks, user.username);
      SchedulerService.pageQueue.push({ userId: user._id, pages: [{ pI, doc: userPage }] });  // @see update()
    });    
    Stats.jobRefreshed();
  }

  // ---------- Helpers ----------
  static async getTemplate(templateId, username) {
    let template = await Template.findById(templateId);
    if(!template) { 
      logger.warn(`getTemplate: Couldn't find template ${templateId} for user: ${username}`);
      return null;
    } else {
      return template;
    }
  }

  static getScraperQueue(isDynamic){
    return (isDynamic)? SchedulerService.dynamicScraperQueue: SchedulerService.staticScraperQueue;
  }

  static createJob({ uI, pI, userPage, template, scheduled }) {   
    return {
      // to be used as a reference when job is done or in logs
      uI: uI,
      pI: pI,

      // main fields
      shard: (SchedulerService.state)? SchedulerService.state.shard: null,
      url: userPage.pageUrl,
      selectors: template.selectors,
      filters: userPage.filters,
      lastId: (userPage.links.length)? userPage.links[0].id: null,
      scheduled: scheduled || true
    };
  }

  static updatePage(userPage, newLinks, username) {
    var maxPageLinks = User.MAX_PAGE_LINKS;

    userPage.notifications = Math.min(maxPageLinks, userPage.notifications + newLinks.length);
    userPage.links = newLinks.concat(userPage.links).slice(0, maxPageLinks);
    userPage.lastUpdate = (new Date).getTime();
    userPage.updated = (newLinks.length)? true: undefined;    // a flag to avoid updating all pages @see update()

    logger.info(`updatePage: Found new ${newLinks.length} to user ${username}` +
      ` on pageId: ${userPage._id}, url: ${userPage.pageUrl}`);
  }

  // ---------- States ----------
  // States to keep track of which state (or phase) the scheduler is in.
  
  /**
   * Initial state. 
   * Clears all the jobs in queues and increment the cycle (shard) number
   * 
   */
  static InitState () {   
    logger.info(`State: Initial State`);

    if(SchedulerService.state && SchedulerService.state.isScraping) {
      logger.warn(`Initial State: Triggered while it's in Scraping State!`);
    }

    // clear all queues (any in jobs to be processed)
    SchedulerService.staticScraperQueue.clear();
    SchedulerService.dynamicScraperQueue.clear();
    SchedulerService.pageQueue.clear();

    // assign current state
    return SchedulerService.state = {
      shard: (SchedulerService.state)? (SchedulerService.state.shard % config.mongodb.shards) + 1: 1,
      users: [],
      inProgress: false
    }
  }

  /**
   * Scraping state. 
   * It when the scraping is being executed.
   * 
   */
  static ScrapingState () {
    logger.info(`State: Scraping State`);

    SchedulerService.state.isScraping = true;
    return SchedulerService.state;
  }

  /**
   * Updating state. 
   * It when updating the users' page is being executed (after scraping is done).
   * It also clears the scraping queues.
   */
  static UpdateState () {
    logger.info(`State: Update State`);

    // clear scrapping queues
    SchedulerService.staticScraperQueue.clear();
    SchedulerService.dynamicScraperQueue.clear();

    // update current state
    SchedulerService.state.isScraping = false;

    return SchedulerService.state;
  }

}

module.exports = SchedulerService;