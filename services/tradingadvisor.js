var _ = require('underscore');
var async = require('async');
var fs = require('fs');

var advisor = function(indicatorSettings, backTesting, storage, logger) {

	this.candleStickSize = indicatorSettings.candleStickSizeMinutes;
	this.backTesting = backTesting;
	this.storage = storage;
	this.logger = logger;

	try {

		this.indicators = {};

		fs.readdirSync('./indicators/').forEach(function(file) {
			if(file != 'template.js' && file.indexOf('.') > 0 && file.indexOf('.js') > 0) {
				var indicator = require('../indicators/' + file);
				this.indicators[file.replace('.js', '')] = indicator;
			}
		}.bind(this));

		this.selectedIndicator = new this.indicators[indicatorSettings.indicator](indicatorSettings.options);

	} catch(err) {

		var err = new Error('Wrong indicator chosen. This indicator doesn\'t exist.');
		this.logger.error(err.stack);
		process.exit();

	}

	_.bindAll(this, 'start', 'update', 'setPosition', 'setIndicator');

};

/*//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(advisor, EventEmitter);
//---EventEmitter Setup*/

advisor.prototype.start = function() {

	this.storage.getLastNCompleteAggregatedCandleSticks(1000, this.candleStickSize, function(err, candleSticks) {

		for(var i = 0; i < candleSticks.length; i++) {

			var result = this.selectedIndicator.calculate(candleSticks[i]);

		}

	}.bind(this));

};

advisor.prototype.update = function(cs) {

	var result = this.selectedIndicator.calculate(cs);

	if(!this.backTesting) {
		this.logger.log('Advice: ' + result.advice + ' (' + result.indicatorValue + ')');
	} else {
		this.logger.debug('Advice: ' + result.advice + ' (' + result.indicatorValue + ')');
	}

	if(['buy', 'sell', 'hold'].indexOf(result.advice) >= 0) {
		//this.emit('advice', result.advice);
		return result.advice;
	} else {
		var err = new Error('Invalid advice from indicator, should be either: buy, sell or hold.');
		this.logger.error(err.stack);
		process.exit();
	}

};

advisor.prototype.setPosition = function(pos) {

	this.selectedIndicator.setPosition(pos);

};

advisor.prototype.setIndicator = function(indicatorSettings) {

	this.selectedIndicator = new this.indicators[indicatorSettings.indicator](indicatorSettings.options);

};

module.exports = advisor;
