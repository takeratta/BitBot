var _ = require('underscore');
var BigNumber = require('bignumber.js');

var aggregator = function(candleStickSizeMinutes, storage, logger) {

	this.storage = storage;
	this.candleStickSize = candleStickSizeMinutes;
	this.logger = logger;

	_.bindAll(this, 'update');

};

//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(aggregator, EventEmitter);
//---EventEmitter Setup

aggregator.prototype.update = function() {

	if(this.storage.length(this.candleStickSize) > 0) {

		this.previousCandlePeriod = this.storage.getLastNonEmptyPeriod(this.candleStickSize);

		var cs = this.storage.getLastCompleteAggregatedCandleStick(this.candleStickSize);

		this.latestCandlePeriod = this.storage.getLastNonEmptyPeriod(this.candleStickSize);

		if(this.latestCandlePeriod > this.previousCandlePeriod) {

			this.logger.log('Created a new ' + this.candleStickSize + ' minute candlestick!');
			this.logger.log(JSON.stringify(cs));

			this.emit('update', cs);

			this.storage.removeOldCandles();

		}

	} else {

		this.storage.getFinishedAggregatedCandleSticks(this.candleStickSize);

	}

};

module.exports = aggregator;
