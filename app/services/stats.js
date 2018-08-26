'use strict';

const logger = require('../core/logger');
const statsModel = require('../core/database').models.stats;

const PERSIST_INTERVAL = 3 * 3600000;   // 3 hours

/**
 * Stats
 * Tracks all events especially jobs.
 * It then persist them to database every PERSIST_INTERVAL.
 * It also logs the stats with every cycle (@see Scheduler)
 */
class Stats {
  constructor() {
  }

  static async construct() {
    Stats.stats = {
      jobsPushed: 0,
      jobsPushedUnique: 0,
      jobsDone: 0,
      jobsFailed: 0,
      jobsFailedUnique: 0,
      jobsResolved: 0,
      jobsExceededTrials: 0,
      urlsFailed: {},
      urlsExceededTrails: {},
      queuesFailed: {},
      queuesJobs: {},
      jobsDelayed: 0,
      jobsRefreshed: 0,
    };

    try {
      var stats = await statsModel.findOne({}, {}, { sort: { 'date' : -1 } }).lean().exec();      
    } catch (err) {
      logger.error(`Stats: Couldn't load stats!.`, err);
      throw err;    // terminate the application. It's not in valid state.
    }

    if(stats) {
      // ignore _id, __v, date, etc
      Object.keys(stats).forEach(key => { 
        if(Stats.stats.hasOwnProperty(key)) { Stats.stats[key] = stats[key]; }
      });
    }

    setInterval(Stats.persist, PERSIST_INTERVAL);
  }

  static jobPushed(trails) {
    if(!trails) { Stats.stats['jobsPushedUnique']++; }
    Stats.stats['jobsPushed']++;
  }

  static jobDone(trails) {
    if(trails) { Stats.stats['jobsResolved']++; }
    Stats.stats['jobsDone']++;
  }

  static jobFailed({ url, queue, trails }) {
    if(url)   { Stats.urlFailed(url.replace(/\./g,'/')); }
    if(queue) { Stats.queuesFailed(queue); }
    if(trails === 1) { Stats.stats['jobsFailedUnique']++; }

    Stats.stats['jobsFailed']++;
  }

  static jobExceededTrails(url) {
    if(url) { Stats.urlExceededTrails(url.replace(/\./g,'/')); }
    Stats.stats['jobsExceededTrials']++;
  }

  static urlFailed(url) {
    let urlsFailed = Stats.stats['urlsFailed'];
    urlsFailed[url] = (urlsFailed[url] || 0) + 1;
  }

  static urlExceededTrails(url) {
    let urlsExceededTrails = Stats.stats['urlsExceededTrails'];
    urlsExceededTrails[url] = (urlsExceededTrails[url] || 0) + 1;
  }

  static queuesFailed(queue) {
    let queuesFailed = Stats.stats['queuesFailed'];
    queuesFailed[queue] = (queuesFailed[queue] || 0) + 1;
  }

  static queueJobs(queue, current, waiting) {
    let queuesJobs = Stats.stats['queuesJobs'];
    if(!queuesJobs[queue]) queuesJobs[queue] = { 'current': 0, 'waiting': 0};
    queuesJobs[queue]['current'] = current;   
    queuesJobs[queue]['waiting'] = waiting;
  }

  static jobDelayed() {
    Stats.stats['jobsDelayed']++;
  }

  static jobRefreshed() {
    Stats.stats['jobsRefreshed']++;
  }

  static get(key) {
    return Stats.stats[key];
  }

  static getAll() {
    return Stats.stats;
  }

  static log(cycle) {
    let { success, error } = Stats.summary();
    // Marking it as 'warn' is a way to ship it to loggly while on production. 
    // As we only log warn (and above levels). 
    logger.warn(`Stats: ${cycle}, success: ${success}%, error: ${error}%`, Stats.stats);
  }

  static persist(){
    var newStats = statsModel(Object.assign(Stats.summary(), Stats.stats));
    newStats.save(function (err) {
      if (err) { logger.error(`Stats: Couldn't save stats!.`, err); }
    });
  }

  static summary() {
    let success = parseInt((Stats.stats['jobsDone'] / Stats.stats['jobsPushedUnique']) * 100);
    let error   = parseInt((Stats.stats['jobsFailedUnique'] / Stats.stats['jobsPushedUnique']) * 100);
    return { success, error };
  }

  static add(key, value) {
    Stats.stats[key] = value;
  }

  static update(key, value) {
    let entry = Stats.stats[key];
    if(!entry) { return; }
    Stats.stats[key] = value;
  }

  static clear(key) {
    if(key) { delete Stats.stats[key]; }
    else {  Stats.construct(); }
  }
}

(async function () { await Stats.construct(); })();
module.exports = Stats;