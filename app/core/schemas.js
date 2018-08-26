'use strict';

const Schema 	= require('mongoose').Schema;
const bcrypt = require('bcrypt-nodejs');
const config = require('../config');

/**
 * User schema.
 * 
 * Every user document contains all information about that user.
 * It has an array of pages. Each page is what to be scrapped.
 * Each page has list of links, a title, url, etc.
 * The links list might be a list of products, news, etc depending on the page.
 * 
 * @returns {Object} Mongoose user schema
 */
function user () {
  const SALT_WORK_FACTOR = 10;
  const DEFAULT_USER_PICTURE = "/img/user.jpg";

  var UserSchema = new Schema({
    username: { type: String, required: true, index: true },
    email: { type: String },    // only available when user is registered via social account 
    
    // If the user registered via username and password (i.e. LocalStrategy), then socialId should be null.
    // If the user registered via social authenticaton, then password should be null, and socialId should be assigned to a value. 
    password: { type: String, default: null },
    socialId: { type: String, default: null, index: true },
    
    picture:  { type: String, default:  DEFAULT_USER_PICTURE },
    shard:  { type: Number,  /* required: true, */ index: true }, // will be added anyway @see pre('save')
    lastLogin: { type: Number, default: (new Date()).getTime() },
    pages: [ {
        // @see https://github.com/Automattic/mongoose/issues/1285#issuecomment-13419165
        _id: { type: Schema.ObjectId, auto: true },
        title: { type: String, required: true },

        // A reference to template Id (see below 'TemplateSchema')
        templateId: { type: String, required: true },

        pageUrl: { type: String, required: true },
        notifications: { type: Number, default: 0 },
        lastUpdate: { type: Number, default: 0 },
        links: { type: [ Schema.Types.Mixed ] },
        muted: { type: Boolean, default: false },
        filters: { 
          contains: { type: String, default: null } 
        }
      }
    ],
    votes: { type: Schema.Types.Mixed, default: {} }
  });

  /**
  * Before save a user document, Make sure:
  * 1. User is assigned to a shard. Users are assigned to logical shards (groups).
  *    Why they are assigned to different shards? @see services/scheduler.js
  * 2. Hash user's password
  */
  UserSchema.pre('save', function(next) {
      var user = this;

      // assign shard 
      // TODO assign shards evenly instead of randomly
      if(!user.shard) {
        user.shard = (parseInt(Math.random() * 10) % config.mongodb.shards) + 1;
      }

      // only hash the password if it has been modified (or is new)
      if (!user.isModified('password')) return next();

      // generate a salt
      bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
          if (err) return next(err);

          // hash the password using our new salt
          bcrypt.hash(user.password, salt, null, function(err, hash) {
              if (err) return next(err);

              // override the cleartext password with the hashed one
              user.password = hash;
              next();
          });
      });
  });

  /**
  * Create an instance method to validate user's password
  * This method will be used to compare the given password with the passwoed stored in the database
  */
  UserSchema.methods.validatePassword = function(password, callback) {
      bcrypt.compare(password, this.password, function(err, isMatch) {
          if (err) return callback(err);
          callback(null, isMatch);
      });
  };

  return UserSchema;
}

/**
 * Template schema.
 * Template is is webpage(s) with the same layout. 
 * For example all the below links they have the same layout.
 * So, they can be grouped under a 'Template',
 * Which defines a one specific way on how to scrap the webpage.
 * 
 * https://www.reddit.com/r/SideProject/
 * https://www.reddit.com/new/
 * https://www.reddit.com/r/jobs
 * 
 * @returns {Object} Mongoose template schema
 */
function template() {
  var TemplateSchema = new Schema({
    name: { type: String, required: true }, 
    // icon: { type: String, required: true },
    dynamic: { type: Boolean, default: false },
    updateInterval: { type: Number, default: 4 },  
    
    sampleUrls: { type: [String], required: true },
    regex: { type: String, required: true },    // used to validate the pages[].pageUrl (see UserSchema)

    // selectors answer the question of where to find the content in the HTML page.
    selectors: { 
      list: { type: String, required: true },
      waitFor: { type: String },   // only if dynamic
      // meta data
      // -- required
      id: { type: String, required: true },
      url: { type: String, required: true },
      title: { type: String, required: true },
      // -- optional
      content: { type: String },
      image: { type: String },
      date: { type: String },
      author: { type: String }
    },
  }, { strict: false });  

  return TemplateSchema;
}

/**
 * Stats schema.
 * Stats is used to keep track of events happening espcially scrapping events.
 * How many successed, failed, in progress, and so on.
 * 
 * @returns {Object} Mongoose stats schema
 */
function stats() {
  var StatsSchema = new Schema({ 
    date: { type: Date, default: Date.now, index: true } 
    // size (~ 500 doc) has precedence over max
  }, { strict: false, capped: { size: 614400, max: 500 } });   

  return StatsSchema;
}

/**
 * Votes schema.
 * Used to create a poll to vote on requested Templates to be added.
 * 
 * @returns {Object} Mongoose votes schema
 */
function votes() {
  var VotesSchema = new Schema({
    title: { type: String, required: true }, 
    url: { type: String, required: true },
    count: { type: Number, default: 0, min: 0 }
  });

  return VotesSchema;
}

module.exports = {
  user: user(),
  template: template(),
  stats: stats(),
  votes: votes()
};