'use strict';

var async = require('async');
const logger = require('../../core/logger');
var Stats = require('../stats');

// constants
const MAX_TRIALS = 3;

/**
 * Queue
 * 
 * A queue of jobs. 
 * It's built on top of async.queue() to limit the number of jobs to be executed concurrently.
 * 
 * It has a reference to a worker that will carry out the work.
 * The worker is passed in the constructor.
 * 
*/
class Queue {
  constructor({ worker, concurrency, name }) {
    this.name = name;
    this.worker = worker;

    // construct queue
    this.construct({ concurrency });
  }

  /**
   * Constructs the queue.
   * 
  */
  construct({ concurrency }) {
    var self = this;
    this.queue = async.queue(async function({ job, callback }) {
      logger.info(`Queue(${self.name}): Processing Job => ${job.jobId}`);
      logger.info(`Queue(${self.name}): Jobs Currently being processed => ${self.queue.running()}`);
      logger.info(`Queue(${self.name}): Jobs Waiting To be processed => ${self.queue.length()}`);
      Stats.queueJobs(self.name, self.queue.running(), self.queue.length())

      try {
        await self.process(job, callback);
      } catch(err) {}   // will be handled @see handle()

    }, concurrency);

    this.queue.error = function(err, { job, callback }) { 
      self.handle(err, { job, callback }); 
    }
  }

  /**
   * Push a job to the queue.
   * Each job is assigned a random Id to be tracked later.
   * 
  */
  push (job, callback) {
    job.jobId = job.jobId || Math.random().toString(36).substring(4);

    logger.info(`Queue(${this.name}): Push Job => ${job.jobId}`, { job: this.logJob(job) });
    Stats.jobPushed(job.trails);

    this.queue.push({ job, callback });
  }
  
  /**
   * Pull out a job and send it to the worker.
   * If succeded, the execute the callback (if exists)
   * If failed, pass the job to handle()
  */
  process(job, callback) {
    return this.worker.doWork(job)
      .then(data => {     
        logger.info(`Queue(${this.name}): Done Processing => ${job.jobId}`);
        Stats.jobDone(job.trails);
        if(!callback) { return; }

        callback({ data, jobId: job.jobId, shard: job.shard, uI: job.uI, pI: job.pI });
      }).catch(err => {
        this.handle(err, { job, callback });
        // throw the error again so it can be populated to whoever is listening
        // @see construct()
        throw err;
    }); 
  }

  /**
   * Handle job failure.
   * If failed, will be inserted again to the queue up to MAX_TRIALS times.
   * After that, It will be ignored.
   * 
   * Any failed job pushed to the queue will be handled by the queue itself.
  */
  handle(err, { job, callback }) {
    // set number of trials
    job.trails = job.trails || 1;
    // add the url to error (by default it's added by dynamic scraper)
    if(job.url) err.url = job.url;  
    
    logger.warn(`Queue(${this.name}): Failed Job => ${job.jobId} With trails: ${job.trails}`, err);
    Stats.jobFailed({ url: job.url, queue: this.name, trails: job.trails });

    if(job.trails > MAX_TRIALS) {
      logger.warn(`Queue(${this.name}): Failed Job => ${job.jobId} Exceeded max trials`);
      Stats.jobExceededTrails(job.url);
    } else {
      job.trails += 1;
      this.push(job, callback);
    }
  }

  /**
   * Clear the jobs in the queue.
   * Only remove the jobs that are 'scheduled'; 
   * Pushed during the cyle @see scheduler() in Scheduler
  */
  clear () { 
    // jobs waiting in the queue to be processed
    let len = this.queue.length();  
    let self = this, removed = 0;

    // this.queue.kill();
    this.queue.remove(function ({ data }) {
      let isScheduled = (data.job.scheduled === true); 
      removed += (isScheduled);

      if(--len === 0 && removed) {
        logger.warn(`Queue(${self.name}): Removed ${removed} jobs still in process.`);
      }

      return isScheduled;
    });
  }
  
  /**
   * Defines what to log about the job
   * 
   */
  logJob(job) {
    return {
      shard: job.shard,
      url: job.url,
      userId: job.uI,
      pageId: job.pI,
      scheduled: job.scheduled,
      username: job.user? job.user.username: undefined
    }
  }

}

module.exports = Queue;