'use strict';

const logger = require('../core/logger');
const User = require('../models/user');
const SchedulerService = require('../services/scheduler');
const Votes = require('../core/database').models.votes;
const Utils = require('../core/utils');

class UserService {
  constructor() {
  }

  /**
   * Get user's home page.
   * It simply gets user data, and subset of the links.
   * The links are shuffled; They are for different pages.
   * 
   * @param {String} userId
   */
  static async home(userId) {
    let userAndPages = await User.findByIdAndSelect(userId, {
      'username' : 1,
      'picture': 1,
      'pages.title': 1,
      'pages.notifications': 1,
      'pages.muted': 1,
      'pages.pageUrl': 1,
      'pages.lastUpdate': 1,
      // 'pages.links': {$slice: 2 },
      'pages.links': 1
    });

    // flatten links
    var links = []; 
    userAndPages.pages.forEach((page, pI) => { 
      if(page.links.length) {
        page.links = page.links.map(link => { link.pageTitle = page.title; return link });
        links = links.concat(page.links);
      }
      delete userAndPages.pages[pI].links;
    });
    
    // shuffle and limit size
    links = Utils.shuffle(links).slice(0, User.LINKS_LIMIT);
    return { userAndPages, links };
  }

  /**
   * Get user's page passing it's index in array
   * 
   * @param {String} userId
   * @param {Number} pI - page Index
   */
  static getPage(userId, pI, offset) {
    return User.getPage(userId, pI, offset);
  }

  /**
   * Clear out notifications for a page
   * 
   * @param {String} userId
   * @param {Number} pI - page Index
   */
  static clearNotifications(userId, pI) {
    User.clearNotifications(userId, pI).catch(err => {
      logger.warn(`clearNotifications: Falied to clear notificatons for user: ${userId} and page: ${pI}`, err);
    });
  }

  /**
   * Add a page 
   * 
   * @param {String} userId
   * @param {Number} pI - page Index
   */
  static async addPage(userId, page) {
    let user  = await User.findById(userId);
    if(user.pages.length >= User.MAX_PAGES) {
      return { error: `You can't add more pages. \n Max number of pages is ${User.MAX_PAGES}.` };
    }

    user.pages.push(page);
    return user.save();
  }

  static mutePage(userId, pI, muted) {
    return User.mutePage(userId, pI, muted);
  }

  static async refresh(userId, pI) {
    var user = await User.getUserAndPage(userId, pI);
    var userPage = user.pages[0];
    
    if(!userPage) {
      return { error: `The page doesn't exist.` };
    } 
    
    let canUpdate = await User.canUpdatePage(userPage); 
    if(!canUpdate) {
      return { error: `You can't refresh the page. \n It's either muted or it has been updated recently.` };
    }

    SchedulerService.refresh(user, pI, userPage);
  }

  static async delete (userId, pI) {
    var user = await User.findById(userId);
    var userPage = user.pages[pI];
    
    if(!userPage) {
      return { error: `The page doesn't exist.` };
    } 

    user.pages.splice(pI, 1);		// remove    
	  return user.save();
  }

  static addVote(vote) {
    // TODO every user can only create 1,2, or 3 votes max.
    return (new Votes(vote)).save();
  }

  static async vote(userId, userVote) {
    try {
      var vote = await Votes.findById(userVote.id);
      if(!vote) { return; }   // return silently

      // update user's vote first then votes count
      var user = await User.findById(userId);
      if(userVote.up === true && !user.votes[userVote.id]) { 
        // user.votes[userVote.id] = true;
        user.set(`votes.${userVote.id}`, true);
        user.save();

        vote.count = vote.count+1;
        vote.save();

      } else if (userVote.up === false && user.votes[userVote.id] === true) {
        // user.votes[userVote.id] = undefined;
        user.set(`votes.${userVote.id}`, undefined);
        user.save();

        vote.count = Math.max(0, vote.count-1);
        vote.save();
      }
    } catch(err) {
      logger.warn(`Votes: Couldn't update vote for user ${userId}`);
    }
  }
}

module.exports = UserService;
