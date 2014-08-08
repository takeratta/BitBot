var _ = require('underscore');
var config = require('../config.js');
var storage = require('../services/candlestorage.js');
var dataprocessor = require('../services/dataprocessor.js');
var processor = new dataprocessor(config.candleStickSizeMinutes);

processor.on('initialized', function(){

  var loopArray = storage.getAllCandlesSince();

  var testPeriod = _.first(loopArray).period - 60;
  var success = true;

  _.each(loopArray, function(cs) {

    if(cs.period !== testPeriod + 60) {
      success = false;
    }

    testPeriod += 60;

  });

  if(success) {
    console.log("Database OK!");
  } else {
    console.log("Database corrupt, empty your database and try collection historical information again");
  }

});

processor.initialize();
