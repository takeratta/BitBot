var _ = require('underscore');

var loggingservice = require('../services/loggingservice.js');
var storageservice = require('../services/storage.js');
var exchangeapiservice = require('../services/exchangeapi.js');
var dataretriever = require('../services/dataretriever.js');
var dataprocessor = require('../services/dataprocessor.js');
var candleaggregator = require('../services/candleaggregator');
var tradingadvisor = require('../services/tradingadvisor.js');
var tradingagent = require('../services/tradingagent.js');
var pushservice = require('../services/pushservice.js');
var ordermonitor = require('../services/ordermonitor.js');
var profitreporter = require('../services/profitreporter.js');

//------------------------------Config
var config = require('../config.js');
//------------------------------Config

//------------------------------IntializeModules
var logger = new loggingservice('app', config.debug);
var storage = new storageservice(config.exchangeSettings, config.mongoConnectionString, logger);
var exchangeapi = new exchangeapiservice(config.exchangeSettings, config.apiSettings, logger);
var retriever = new dataretriever(config.downloaderRefreshSeconds, exchangeapi, logger);
var processor = new dataprocessor(storage, logger);
var aggregator = new candleaggregator(config.indicatorSettings.candleStickSizeMinutes, storage, logger);
var advisor = new tradingadvisor(config.indicatorSettings, false, storage, logger);
var agent = new tradingagent(config.tradingEnabled, config.exchangeSettings, storage, exchangeapi, logger);
var pusher = new pushservice(config.pushOver, logger);
var monitor = new ordermonitor(exchangeapi, logger);
var reporter = new profitreporter(config.exchangeSettings.currencyPair, storage, exchangeapi, logger);
//------------------------------IntializeModules

var trader = function() {

  retriever.on('update', function(ticks){

    processor.updateCandleDB(ticks);

  });

  processor.on('initialDBWrite', function(){

    reporter.start(config.resetInitialBalances);

    advisor.start();

  });

  processor.on('update', function(cs){

    aggregator.update();

  });

  aggregator.on('update', function(cs){

    var advice = advisor.update(cs, false);

    if(advice === 'buy') {

      agent.order(advice);

    } else if(advice === 'sell') {

      agent.order(advice);

    }

  });

  agent.on('realOrder',function(orderDetails){

    if(config.pushOver.enabled) {
      pusher.send('BitBot - Order Placed!', 'Placed ' + orderDetails.orderType + ' order: (' + orderDetails.amount + '@' + orderDetails.price + ')', 'magic', 1);
    }

    monitor.add(orderDetails, config.orderKeepAliveMinutes);

  });

  agent.on('simulatedOrder',function(orderDetails){

    if(config.pushOver.enabled) {
      pusher.send('BitBot - Order Simulated!', 'Simulated ' + orderDetails.orderType + ' order: (' + orderDetails.amount + '@' + orderDetails.price + ')', 'magic', 1);
    }

    monitor.add(orderDetails, config.orderKeepAliveMinutes);

  });

  monitor.on('filled', function(order) {

    if(order.orderDetails.orderType === 'buy') {

      advisor.setPosition({pos: 'bought', price: order.orderDetails.price});

    } else if(order.orderDetails.orderType === 'sell') {

      advisor.setPosition({pos: 'sold', price: order.orderDetails.price});

    }

    reporter.updateBalance(true);

  });

  monitor.on('cancelled', function(order, retry) {

    reporter.updateBalance(false);

    if(retry) {

      cancelledOrderRetryTimeout = setTimeout(function(){

        agent.order(order.orderDetails.orderType);

      }, 1000 * 5);

    }

  });

  reporter.on('report', function(report){

    if(config.pushOver.enabled) {
      pusher.send('BitBot - Profit Report!', report, 'magic', 1);
    }

  });

  _.bindAll(this, 'start', 'stop');

}

//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(trader, EventEmitter);
//---EventEmitter Setup

trader.prototype.start = function() {

  retriever.start();

};

trader.prototype.stop = function(cb) {

  retriever.stop();

  clearTimeout(cancelledOrderRetryTimeout);

  monitor.resolvePreviousOrder(function() {
    logger.log('BitBot stopped succesfully!');
    cb();
  }.bind(this));

  this.emit('done');

};

var traderApp = new trader();

module.exports = traderApp;
