var _ = require('underscore');
var tools = require('../util/tools.js');
var async = require('async');

var loggingservice = require('../services/loggingservice.js');
var storageservice = require('../services/storage.js');
var exchangeapiservice = require('../services/exchangeapi.js');
var tradingadvisor = require('../services/tradingadvisor.js');
var simulatorservice = require('../services/simulator.js');

//------------------------------Config
var config = require('../config.js');
//------------------------------Config

//------------------------------IntializeModules
var logger = new loggingservice('backtester', config.debug);
var storage = new storageservice(config.exchangeSettings, config.mongoConnectionString, logger);
var exchangeapi = new exchangeapiservice(config.exchangeSettings, config.apiSettings, logger);
var advisor = new tradingadvisor(config.indicatorSettings, true, storage, logger);
var simulator = new simulatorservice(config.exchangeSettings, config.backTesterSettings, config.indicatorSettings, advisor, logger);
//------------------------------IntializeModules

var backtester = function() {

  _.bindAll(this, 'start');

};

//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(backtester, EventEmitter);
//---EventEmitter Setup

backtester.prototype.start = function() {
  async.series(
    {
      balance: function(cb) {exchangeapi.getBalance(true, cb);},
      aggregatedCandleSticks: function(cb) {storage.getAggregatedCandleSticks(config.indicatorSettings.candleStickSizeMinutes, cb);}
    }, function(err, result) {
      if(result.aggregatedCandleSticks.length > 0) {
        var result = simulator.calculate(result.aggregatedCandleSticks, result.balance.fee);
        simulator.report();
        this.emit('done');
      }
    }.bind(this)
  );
};

var backtesterApp = new backtester();

module.exports = backtesterApp;
