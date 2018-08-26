'use strict';

var Queue = require('./queue');
var QUEUES = {}; 

/**
 * Queue Factory
 *
 * Creates single queue objects. The objects will be stored for later retrieval.
 */
class QueueFactory {
  constructor() {
  }

  static getQueue(queue) {
    if(!QUEUES[queue]) {
      throw Error("Queue doesn't exist!");
    }

    return QUEUES[queue];
  }

  static construct() {
    var queues = {
      'dynamicScraper': { 
        worker:  new (require('../workers/scrapers/dynamic')),
        concurrency: 2
      },
      'staticScraper': { 
        worker:  new (require('../workers/scrapers/static')),
        concurrency: 10
      },
      'proxyScraper': { 
        worker:  new (require('../workers/scrapers/proxy')),
        concurrency: 1
      },
      'page': { 
        worker:  new (require('../workers/page')),
        concurrency: 5
      }
    }
  
    Object.keys(queues).forEach(queue => {
      QUEUES[queue] = new Queue({ 
        worker : queues[queue].worker, 
        concurrency : queues[queue].concurrency, 
        name : queue
       });
    })
  }
}

QueueFactory.construct();
module.exports = QueueFactory;