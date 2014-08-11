var _ = require('underscore');
var async = require('async');
var logger = require('./loggingservice.js');
var api = require('./api.js');

var downloader = function(refreshInterval){

  this.refreshInterval = refreshInterval;
  this.noTradesCount = 0;

  _.bindAll(this, 'start', 'stop', 'processTrades');

};

//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(downloader, EventEmitter);
//---EventEmitter Setup

downloader.prototype.processTrades = function(err, trades) {

  if(!err) {

    this.noTradesCount = 0;

    this.emit('update', trades);

  } else {

    this.noTradesCount += 1;

    if(this.noTradesCount >= 30) {
      logger.error('Haven\'t received data from the API for 30 consecutive attempts, stopping application');
      return process.exit();
    }

  }

};

downloader.prototype.start = function() {

  logger.log('Downloader started!');

  api.getTrades(this.processTrades);

  this.downloadInterval = setInterval(function(){
    api.getTrades(this.processTrades);
  }.bind(this),1000 * this.refreshInterval);

};

downloader.prototype.stop = function() {

  clearInterval(this.downloadInterval);

  logger.log('Downloader stopped!');

};

module.exports = downloader;
