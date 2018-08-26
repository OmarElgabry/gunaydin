/**
 * Configurations.
 * Will be loaded based on current environment (production vs development)
 * Some configurations are shared between them.
 * 
 * Make sure to have the configurations setup beforehand.
 */

var init = function () {
  
  // config object
  var config = {};

  // shared common config
  var shared = {
    mongodb: {
      username: process.env.dbUsername,
      password: process.env.dbPassword,
      host: process.env.dbHost,
      port: process.env.dbPort,
      dbname: process.env.dbName,
      shards: 5
    },

    // logging (loggly)
    loggly: {
      token: process.env.logglyToken,
      subdomain: process.env.logglySubdomain,
    },

    // socail login
    facebook: {
      clientID: process.env.facebookClientID,
      clientSecret: process.env.facebookClientSecret,
      callbackURL: "https://gunaydin.herokuapp.com/auth/facebook/callback",
      profileFields: ['id', 'displayName', 'photos', 'email']
    },
    twitter:{
      consumerKey: process.env.twitterConsumerKey,
      consumerSecret: process.env.twitterConsumerSecret,
      callbackURL: "https://gunaydin.herokuapp.com/auth/twitter/callback",
      profileFields: ['id', 'displayName', 'photos', 'email']
    }
  }

  // config based on if we are on production or local (development)
  config = (process.env.NODE_ENV === 'production')? 
    require('./production'): require('./development');
  
  // merge both, config object has precedence over shared 
  return Object.assign(shared, config);
}

module.exports = init();