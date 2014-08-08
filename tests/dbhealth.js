var _ = require('underscore');
var config = require('../config.js');
var storage = require('../services/candlestorage.js');
var dataprocessor = require('../services/dataprocessor.js');
var processor = new dataprocessor(config.candleStickSizeMinutes);

processor.on('initialized', function(){

  var loopArray = storage.getAllCandlesSince();

  var testPeriod = _.first(loopArray).period - 60;
  var success = true;

  var previousCS;

  _.each(loopArray, function(cs) {

    if(cs.period !== testPeriod + 60) {
      console.log('There is a gap between the following two candlesticks:');
      console.log('Previous: ' + JSON.stringify(previousCS));
      console.log('Current: ' + JSON.stringify(cs));
      success = false;
    }

    previousCS = cs;
    testPeriod += 60;

  });

  if(success) {
    console.log("Database OK!");
  } else {
    console.log("Database corrupt/incomplete, empty your database and try collecting historical information again");
  }

});

processor.initialize();
