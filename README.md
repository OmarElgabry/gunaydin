
![Screenshot](https://raw.githubusercontent.com/OmarElGabry/gunaydin/master/public/img/gunaydin.png)

# Gunaydin!
[![Dependency Status](https://www.versioneye.com/user/projects/57d746d1df40d0004a4a9e21/badge.svg?style=flat-square)](https://www.versioneye.com/user/projects/57d746d1df40d0004a4a9e21)
[![Scrutinizer Code Quality](https://scrutinizer-ci.com/g/OmarElGabry/chat.io/badges/quality-score.png?b=master)](https://scrutinizer-ci.com/g/OmarElGabry/gunaydin/?branch=master)
[![Code Climate](https://codeclimate.com/github/OmarElGabry/chat.io/badges/gpa.svg)](https://codeclimate.com/github/OmarElGabry/gunaydin)

Your good mornings!. "Gunaydin" in Turkish 🇹🇷 language means "Good Morning". 

Every day, I wake up in the morning, go to my work, and the first thing I do is I go throw a list of websites I usually keep an eye on, and check if there's something new. Even worse, sometimes I forget to check some of them, and so I miss some information.

One way to automate the process is to scrap these websites form time to time, and get a list of the latest links (news, products, etc).

The downside is I've to explicitly define how to scrap each website. That's how to find the content in the HTML page. To do so, add a new document in `Template` collection. That's all, and the logic is the same for all.

## Index
+ [Demo](#demo)
+ [Features](#features)
+ [Installation](#installation)
+ [How It Works](#how-it-works)
+ [Support](#support)
+ [Contribute](#contribute)
+ [License](#license)

## Demo<a name="demo"></a>
Check [Demo](https://gunaydin.herokuapp.com/)

## Features<a name="features"></a>
+ Scraps a given list of pages _from time to time_. 
+ Uses [request](https://github.com/request/request) for static pages and [nightmare](https://github.com/segmentio/nightmare) for dynamic pages.
+ Queue async jobs (scraping and saving to database) using [async](https://github.com/caolan/async) 
+ Scraps proxies, rotate between proxies, and randomly assigns user agents.
+ Logs and tracks events especially jobs (how many succeeded, failed (and why), etc.).
+ Logging Errors and Exceptions using [Winston](https://github.com/winstonjs/winston), and logs are shipped to [Loggly](https://www.loggly.com/) via [winston-loggly-bulk](https://github.com/loggly/winston-loggly-bulk)
+ Uses [MongoDB](https://github.com/mongodb/mongo), [Mongoose](https://github.com/Automattic/mongoose) and [MongoLab(mLab)](https://mlab.com/) for storing and querying data.

## Installation<a name="installation"></a>
### Running Locally
Make sure you have [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed.

1. Clone or Download the repository

	```
	$ git clone https://github.com/OmarElGabry/gunaydin.git
	$ cd gunaydin
	```
2. Install Dependencies

	```
	$ npm install
	```
3. Start the application

	```
	$ npm start
	```
Your app should now be running on [localhost:3000](http://localhost:3000/).

### Deploying to Heroku
Make sure you have the [Heroku Toolbelt](https://toolbelt.heroku.com/) installed.

1. Create a new Heroku application, and push your application to a Git remote repository. In order for nightmare to work on heroku, check out this [guide](https://github.com/oscarmorrison/nightmare-heroku).

	```
	$ git init 
	$ heroku create [app-name] 
	$ heroku stack:set cedar-14 set build packs
	$ heroku buildpacks:add --index 1 https://github.com/heroku/heroku-buildpack-apt && heroku buildpacks:add --index 2 https://github.com/captain401/heroku-buildpack-xvfb.git && heroku buildpacks:add --index 3 https://github.com/causztic/heroku-electron-buildpack.git && heroku buildpacks:add --index 4 https://github.com/heroku/heroku-buildpack-nodejs.git
	$ git push heroku master
	```
	or
	
	[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy)

2. Now, you need to set up configuration variables on Heroku. 
	1. Go to Settings -> Reveal Config Vars.
	2. Add configuration variables. You'll need to add configurations for database, social login tokens, loggly, etc.
3. Open your application in the browser
	```
	$ heroku open
	```



## How It Works<a name="how-it-works"></a>
### Setup Configurations<a name="configurations"></a>
Everything from setting up user authentication to database is explained in [chat.io](https://github.com/OmarElGabry/chat.io#how-it-works). I almost copied and pasted the code.
### User & Pages (Model)
Every user document contains all information about that user. It has an array of pages. 

Each **page** is what to be scrapped. Each page has list of links, a title, url, etc, and a reference to the template (see below). The links list might be a list of products, news, etc depending on the page.
### Template (Model)
Template is is webpage(s) with the same layout. For example all the below links they have the same layout. So, they can be grouped under a 'Template', which defines a one specific way on how to scrap the webpage.
- https://www.reddit.com/r/SideProject/
- https://www.reddit.com/new/
- https://www.reddit.com/r/jobs

Thinking about a template? Open an issue, and I'll be happy to add it on the list.

### Shards (aka Cycles)
Users are split-ed into logical shards. So, every time interval, say 1 hour, go to a shard, and scrap all users' pages in that shard. Then, update their listings in the database.
### Queue (Service)
A queue is a list of the async jobs to be processed by the workers. The jobs might be scraping or saving to database. Accordingly, the workers might be scrapers or database workers. 

A queue limits the maximum number of simultaneous operations, and handle the failed job by re-pushing it to the queue (up to maximum of say, 3 times).

There is a generic [Queue class]((https://github.com/OmarElGabry/chat.io/tree/master/app/services/queue/queue.js)), where the [Queue Factory](https://github.com/OmarElGabry/chat.io/tree/master/app/services/queue/factory.js) instantiates different queues with different workers and max concurrent jobs.
### Scrapers (Service)
There are three scrapers; static, dynamic, and a dedicated one for proxies (also dynamic). All [scrapers](https://github.com/OmarElGabry/chat.io/tree/master/app/services/workers/scrapers) inherit from the generic class [Scraper](https://github.com/OmarElGabry/chat.io/tree/master/app/services/workers/scrapers/scraper.js), which provides useful methods to extract data, rotate proxies, randomly assigns user agents, and so on.

All scrapers are also workers and inherit from the [Worker](https://github.com/OmarElGabry/chat.io/tree/master/app/services/workers/worker.js) interface.
### Stats (Service)
It keeps track all events especially jobs. It then persist them to database every some hours.

## Support <a name="support"></a>
I've written this script in my free time during my work. If you find it useful, please support the project by spreading the word. 

## Contribute <a name="contribute"></a>

Contribute by creating new issues, sending pull requests on Github or you can send an email at: omar.elgabry.93@gmail.com

## License <a name="license"></a>
Built under [MIT](http://www.opensource.org/licenses/mit-license.php) license.
