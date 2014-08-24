var _ = require('underscore');
var config = require('../config.js');
var loggingservice = require('../services/loggingservice.js');

var database = require('../services/db.js');
var candlestorage = require('../services/candlestorage.js');
var dataprocessor = require('../services/dataprocessor.js');

var logger = new loggingservice(config.debug);
var db = new database(config.exchangeSettings, config.mongoConnectionString, logger);
var storage = new candlestorage(db, logger);
var processor = new dataprocessor(storage, logger);

processor.on('initialized', function(){

  var loopArray = storage.getAllCandlesSince();

  var testPeriod = _.first(loopArray).period - 60;
  var success = true;

  var previousCS;

  _.each(loopArray, function(cs) {

    if(cs.period !== testPeriod + 60) {
      logger.log('There is a gap between the following two candlesticks:');
      logger.log('Previous: ' + JSON.stringify(previousCS));
      logger.log('Current: ' + JSON.stringify(cs));
      success = false;
    }

    previousCS = cs;
    testPeriod += 60;

  });

  if(success) {
    logger.log("Database OK!");
  } else {
    logger.log("Database corrupt/incomplete, empty your database and try collecting historical information again");
  }

});

processor.initialize();
