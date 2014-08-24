var _ = require('underscore');
var async = require('async');
var fs = require('fs');

var advisor = function(indicatorSettings, candleStickSize, backTesting, storage, logger) {

	this.candleStickSize = candleStickSize;
	this.backTesting = backTesting;
	this.storage = storage;
	this.logger = logger;

	if(fs.existsSync('./indicators/' + indicatorSettings.indicator + '.js')) {
		var indicator = require('../indicators/' + indicatorSettings.indicator + '.js');
		this.selectedIndicator = new indicator(indicatorSettings.options);
	} else {
		var err = new Error('Wrong indicator chosen. This indicator doesn\'t exist.');
		this.logger.error(err.stack);
		process.exit();
	}

	_.bindAll(this, 'start', 'update', 'setPosition');

};

//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(advisor, EventEmitter);
//---EventEmitter Setup

advisor.prototype.start = function() {

	var candleSticks = this.storage.getFinishedAggregatedCandleSticks(this.candleStickSize);

	for(var i = 0; i < candleSticks.length; i++) {

		var result = this.selectedIndicator.calculate(candleSticks[i]);

	}

};

advisor.prototype.update = function(cs) {

	var result = this.selectedIndicator.calculate(cs);

	if(!this.backTesting) {
		this.logger.log('Advice: ' + result.advice + ' (' + result.indicatorValue + ')');
	} else {
		this.logger.debug('Advice: ' + result.advice + ' (' + result.indicatorValue + ')');
	}

	if(['buy', 'sell', 'hold'].indexOf(result.advice) >= 0) {
		this.emit('advice', result.advice);
	} else {
		var err = new Error('Invalid advice from indicator, should be either: buy, sell or hold.');
		this.logger.error(err.stack);
		process.exit();
	}

};

advisor.prototype.setPosition = function(pos) {

	this.selectedIndicator.setPosition(pos);

};

module.exports = advisor;
