var _ = require('underscore');
var async = require('async');
var logger = require('./loggingservice.js');
var storage = require('./candlestorage.js');
var fs = require('fs');

var advisor = function(indicatorSettings, candleStickSize, backTesting) {

	this.candleStickSize = candleStickSize;
	this.backTesting = backTesting;

	if(fs.existsSync('./indicators/' + indicatorSettings.indicator + '.js')) {
		var indicator = require('../indicators/' + indicatorSettings.indicator + '.js');
		this.selectedIndicator = new indicator(indicatorSettings.options);
	} else {
		var err = new Error('Wrong indicator chosen. This indicator doesn\'t exist.');
		logger.error(err.stack);
		process.exit();
	}

	_.bindAll(this, 'start', 'update');

};

//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(advisor, EventEmitter);
//---EventEmitter Setup

advisor.prototype.start = function() {

	var candleSticks = storage.getFinishedAggregatedCandleSticks(this.candleStickSize);

	for(var i = 0; i < candleSticks.length; i++) {

		var advice = this.selectedIndicator.calculate(candleSticks[i]);

	}

};

advisor.prototype.update = function(cs) {

	var advice = this.selectedIndicator.calculate(cs);

	if(!this.backTesting) {
		logger.log('Advice: ' + advice);
	} else {
		logger.debug('Advice: ' + advice);
	}

	if(['buy', 'sell', 'hold'].indexOf(advice) >= 0) {
		this.emit('advice', advice);
	} else {
		var err = new Error('Invalid advice from indicator, should be either: buy, sell or hold.');
		logger.error(err.stack);
		process.exit();
	}

};

module.exports = advisor;
