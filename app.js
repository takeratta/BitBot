var _ = require('underscore');

var loggingservice = require('./services/loggingservice.js');

//------------------------------Config
var config = require('./config.js');
//------------------------------Config

//------------------------------IntializeModules
var logger = new loggingservice('app', config.debug);
//------------------------------IntializeModules

//------------------------------AnnounceStart
logger.log('----------------------------------------------------');
logger.log('Starting BitBot v0.9.5');
logger.log('Real Trading Enabled = ' + config.tradingEnabled);
logger.log('Working Dir = ' + process.cwd());
logger.log('----------------------------------------------------');
//------------------------------AnnounceStart

var app = function() {

  _.bindAll(this, 'appListener', 'launchTrader', 'launchBacktester', 'start');

};

app.prototype.appListener = function() {

  this.app.on('done', function() {
    logger.log('App closed.');
  }.bind(this));

};

app.prototype.launchTrader = function() {

  logger.log('----------------------------------------------------');
  logger.log('Launching trader module.');
  logger.log('----------------------------------------------------');
  this.app = require('./apps/trader.js');
  this.appListener();
  this.app.start();

}

app.prototype.launchBacktester = function() {

  logger.log('----------------------------------------------------');
  logger.log('Launching backtester module.');
  logger.log('----------------------------------------------------');
  this.app = require('./apps/backtester.js');
  this.appListener();
  this.app.start();

}

app.prototype.start = function() {

  var argument = process.argv[2];

  if(!argument) {
    this.launchTrader();
  } else {
    if(argument === '-b') {
      this.launchBacktester();
    } else {
      logger.log('Invalid argument, supported options:');
      logger.log('-b: Launch Backtester');
    }
  }

};

var application = new app();

application.start();
