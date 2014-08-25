var _ = require('underscore');

var loggingservice = require('./services/loggingservice.js');
var database = require('./services/db.js');
var candlestorage = require('./services/candlestorage.js');
var exchangeapiservice = require('./services/exchangeapi.js');
var dataretriever = require('./services/dataretriever.js');
var dataprocessor = require('./services/dataprocessor.js');
var candleaggregator = require('./services/candleaggregator');
var tradingadvisor = require('./services/tradingadvisor.js');
var tradingagent = require('./services/tradingagent.js');
var pushservice = require('./services/pushservice.js');
var ordermonitor = require('./services/ordermonitor.js');
var profitreporter = require('./services/profitreporter.js');
var pricemonitor = require('./services/pricemonitor');

//------------------------------Config
var config = require('./config.js');
//------------------------------Config

//------------------------------IntializeModules
var logger = new loggingservice(config.debug);
var db = new database(config.exchangeSettings, config.mongoConnectionString, logger);
var storage = new candlestorage(db, logger);
var exchangeapi = new exchangeapiservice(config.exchangeSettings, config.apiSettings, logger);
var retriever = new dataretriever(config.downloaderRefreshSeconds, exchangeapi, logger);
var processor = new dataprocessor(storage, logger);
var aggregator = new candleaggregator(config.candleStickSizeMinutes, storage, logger);
var advisor = new tradingadvisor(config.indicatorSettings, config.candleStickSizeMinutes, false, storage, logger);
var agent = new tradingagent(config.tradingEnabled, config.exchangeSettings, storage, exchangeapi, logger);
var pusher = new pushservice(config.pushOver, logger);
var monitor = new ordermonitor(exchangeapi, logger);
var reporter = new profitreporter(config.exchangeSettings.currencyPair, db, exchangeapi, logger);
var pricemon = new pricemonitor(config.stoplossSettings.percentageBought, config.stoplossSettings.percentageSold, config.candleStickSizeMinutes, storage, logger);
//------------------------------IntializeModules

retriever.on('update', function(ticks){

    processor.updateCandleDB(ticks);

});

processor.on('initialized', function(){

    retriever.start();

});

processor.on('initialDBWrite', function(){

    reporter.start(config.resetInitialBalances);

    advisor.start();

});

processor.on('update', function(cs){

    if(config.stoplossSettings.enabled) {

        pricemon.check(cs.close);

    }

    aggregator.update();

});

aggregator.on('update', function(cs){

    if(config.stoplossSettings.enabled) {

        pricemon.update(cs);

    }

    advisor.update(cs, false);

});

advisor.on('advice', function(advice){

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

        pricemon.setPosition('bought', order.orderDetails.price);
        advisor.setPosition({pos: 'bought', price: order.orderDetails.price});

    } else if(order.orderDetails.orderType === 'sell') {

        pricemon.setPosition('sold', order.orderDetails.price);
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

pricemon.on('advice', function(advice) {

    if(advice === 'buy') {

        agent.order(advice);

    } else if(advice === 'sell') {

        agent.order(advice);

    }

});

reporter.on('report', function(report){

    if(config.pushOver.enabled) {
        pusher.send('BitBot - Profit Report!', report, 'magic', 1);
    }

});

var start = function() {

  //------------------------------AnnounceStart
  console.log('------------------------------------------');
  console.log('Starting BitBot v0.8.2');
  console.log('Real Trading Enabled = ' + config.tradingEnabled);
  console.log('Working Dir = ' + process.cwd());
  console.log('------------------------------------------');
  //------------------------------AnnounceStart

  processor.initialize();

};

var stop = function(cb) {

  retriever.stop();

  clearTimeout(cancelledOrderRetryTimeout);

  monitor.resolvePreviousOrder(function(){
    logger.log('BitBot stopped succesfully!');
    cb();
  });

};

start();
