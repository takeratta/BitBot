var _ = require('underscore');
var BigNumber = require('bignumber.js');
var tools = require('./tools.js');
var db = require('./db.js');

var storage = function() {

	this.candleSticksCollection = [];

	_.bindAll(this, 'selectCollection', 'set', 'push', 'removeOldCandles', 'flush', 'getAllCandlesSince', 'getLastNCandles', 'getLastPeriod', 'getLastNonEmptyPeriod', 'getLastClose', 'getLastNonEmptyClose', 'getCandle', 'length', 'getAverageCandleStickSize', 'generateWebServerArray', 'getFinishedAggregatedCandleSticks', 'getLastCompleteAggregatedCandleStick', 'getAggregatedCandleSticks', 'materialise', 'getDBCandles');

};

storage.prototype.selectCollection = function(candleStickSize) {

	var selectedSize = candleStickSize;

	if(!candleStickSize) {
		selectedSize = 1;
	}

	var candleStickArray = _.find(this.candleSticksCollection, function(entry) {
		return entry.type === selectedSize;
	});

	if(!candleStickArray) {

		this.candleSticksCollection.push({'type': selectedSize, 'candleSticks': []});
		candleStickArray = _.find(this.candleSticksCollection, function(entry) {
			return entry.type === selectedSize;
		});
	}

	return candleStickArray;

};

storage.prototype.set = function(candleSticks, candleStickSize) {

	var candleStickArray = this.selectCollection(candleStickSize);

	candleStickArray.candleSticks = [];

	candleSticks.forEach(function(candleStick){
		candleStickArray.candleSticks.push(candleStick);
	});

};

storage.prototype.push = function(candleStick, candleStickSize) {

	var candleStickArray = this.selectCollection(candleStickSize);

	var updated = false;

	candleStickArray.candleSticks = _.map(candleStickArray.candleSticks, function(entry) {

		if(entry.period === candleStick.period){
			updated = true;
			return candleStick;
		} else {
			return entry;
		}

	}, this);

	if(!updated){

		candleStickArray.candleSticks.push(candleStick);

	}

};

storage.prototype.removeOldCandles = function() {

	var maxCandleSize = _.max(this.candleSticksCollection, function(collection) {
		return collection.type;
	}).type;

	var maxCandleSizeSeconds = maxCandleSize * 60;

	_.each(this.candleSticksCollection, function(collection) {

		var candleStickSize = collection.type;

		var candleStickSizeSeconds = candleStickSize * 60;

		var now = Math.floor(tools.unixTimeStamp(new Date().getTime()) / candleStickSizeSeconds) * candleStickSizeSeconds;
		var oldPeriod = now - (maxCandleSizeSeconds * 2000);

		var candleStickArray = this.selectCollection(candleStickSize);

		candleStickArray.candleSticks = _.filter(candleStickArray.candleSticks, function(candleStick){
			return candleStick.period > oldPeriod;
		});

		if(candleStickSize === 1) {
			db.removeOldDBCandles(oldPeriod);
		}

	}, this);

};

storage.prototype.flush = function(candleStickSize) {

	var candleStickArray = this.selectCollection(candleStickSize);

	candleStickArray.candleSticks = [];

};

storage.prototype.getAllCandlesSince = function(period, candleStickSize) {

	var filterPeriod = period;

	if(!period) {
		filterPeriod = 0;
	}

	var candleStickArray = this.selectCollection(candleStickSize);

	var array = _.filter(candleStickArray.candleSticks, function(candleStick) {

		return candleStick.period >= filterPeriod;

	});

	return array;

};

storage.prototype.getLastNCandles = function(amount, candleStickSize) {

	var candleStickArray = this.selectCollection(candleStickSize);

	var N = amount;

	if(!amount) {

		N = 1;

	}

	return _.last(candleStickArray.candleSticks,N);

};

storage.prototype.getLastPeriod = function(candleStickSize) {

	var candleStickArray = this.selectCollection(candleStickSize);

	var dsLength = candleStickArray.candleSticks.length;

	if(dsLength === 0) {
		return 0;
	} else {
		return _.last(candleStickArray.candleSticks).period;
	}

};

storage.prototype.getLastNonEmptyPeriod = function(candleStickSize) {

	var candleStickArray = this.selectCollection(candleStickSize);

	var dsLength = candleStickArray.candleSticks.length;

	if(dsLength === 0) {
		return 0;
	} else {
		var array = _.filter(candleStickArray.candleSticks, function(candleStick) {
			return candleStick.volume > 0;
		});
		if(array.length === 0) {
			return 0;
		} else {
			return _.last(array).period;
		}
	}

};

storage.prototype.getLastClose = function(candleStickSize) {

	var candleStickArray = this.selectCollection(candleStickSize);

	var dsLength = candleStickArray.candleSticks.length;

	if(dsLength === 0) {
		return 0;
	} else {
		return _.last(candleStickArray.candleSticks).close;
	}

};

storage.prototype.getLastNonEmptyClose = function(candleStickSize) {

	var candleStickArray = this.selectCollection(candleStickSize);

	var dsLength = candleStickArray.candleSticks.length;

	if(dsLength === 0) {
		return;
	} else {
		var array = _.filter(candleStickArray.candleSticks, function(candleStick) {
			return candleStick.volume > 0;
		});
		if(array.length === 0) {
			return 0;
		} else {
			return _.last(array).close;
		}
	}

};

storage.prototype.getCandle = function(period, candleStickSize) {

	var candleStickArray = this.selectCollection(candleStickSize);

	var result = _.find(candleStickArray.candleSticks, function(candleStick) {
		return candleStick.period === period;
	});

	if(!result) {
		return {'period':period,'open':undefined,'high':undefined,'low':undefined,'close':undefined,'volume':0, 'vwap':undefined};
	} else {
		return result;
	}

};

storage.prototype.length = function(candleStickSize) {

	var candleStickArray = this.selectCollection(candleStickSize);

	return candleStickArray.candleSticks.length;

};

storage.prototype.getAverageCandleStickSize = function(csamount, candleStickSize) {

	var candleStickArray = this.selectCollection(candleStickSize);

	var array = _.first(_.last(candleStickArray.candleSticks, csamount + 1), csamount);

	var average = 0;

	if(array.length > 0) {
		average = Number(BigNumber(_.reduce(array, function(memo, entry){ return Number(BigNumber(memo).plus(Math.abs(Number(BigNumber(entry.close).minus(entry.open))))); }, 0)).dividedBy(BigNumber(csamount)).round(2));
	}

	return average;

};

storage.prototype.generateWebServerArray = function(period, candleStickSize) {

	var array = this.getAllCandlesSince(period, candleStickSize);

	var result = [];

	_.each(array,function(entry){

		result.push([entry.period * 1000, entry.open, entry.high, entry.low, entry.close, entry.volume]);

	});

	return result;

};

storage.prototype.getFinishedAggregatedCandleSticks = function(candleStickSize) {

	var array = this.getAggregatedCandleSticks(candleStickSize);
	array = _.filter(array, function(entry){ return entry.period !== _.last(array).period; });

	return array;

};

storage.prototype.getLastCompleteAggregatedCandleStick = function(candleStickSize) {

	var array = this.getAggregatedCandleSticks(candleStickSize);
	array = _.filter(array, function(entry){ return entry.period !== _.last(array).period; });

	return _.last(array);

};

storage.prototype.getAggregatedCandleSticks = function(candleStickSize) {

	var candleStickArray = this.selectCollection(candleStickSize);

	var candleStickSizeSeconds = 60 * candleStickSize;

	var latestAggregatedPeriod = this.getLastNonEmptyPeriod(candleStickSize) - candleStickSizeSeconds;

	var candleSticks = this.getAllCandlesSince(latestAggregatedPeriod, 1);

	var startTimeStamp = (Math.floor(candleSticks[0].period / candleStickSizeSeconds) * candleStickSizeSeconds) + candleStickSizeSeconds;
	var stopTimeStamp = _.last(candleSticks).period;

	for(var i = startTimeStamp;i <= stopTimeStamp;i = i + candleStickSizeSeconds) {

		var beginPeriod = i;
		var endPeriod = beginPeriod + candleStickSizeSeconds;

		var currentCandleStick = {'period':beginPeriod,'open':undefined,'high':undefined,'low':undefined,'close':undefined,'volume':0, 'vwap':undefined};

		var relevantSticks = _.filter(candleSticks, function(candleStick) {

			return candleStick.period >= beginPeriod && candleStick.period < endPeriod;

		},this);

		var vrelevantSticks = _.filter(relevantSticks, function(candleStick) {

			return candleStick.volume > 0;

		},this);

		if(vrelevantSticks.length > 0) {
			relevantSticks = vrelevantSticks;
		}

		currentCandleStick.open = relevantSticks[0].open;
		currentCandleStick.high = _.max(relevantSticks, function(relevantStick) { return relevantStick.high; }).high;
		currentCandleStick.low = _.min(relevantSticks, function(relevantStick) { return relevantStick.low; }).low;
		currentCandleStick.close = relevantSticks[relevantSticks.length - 1].close;
		currentCandleStick.volume = _.reduce(relevantSticks, function(memo, entry) { return Number(BigNumber(memo).plus(BigNumber(entry.volume)).round(8)); }, 0);
		if(currentCandleStick.volume === 0) {
			currentCandleStick.vwap = currentCandleStick.close;
		} else {
			currentCandleStick.vwap = Number(BigNumber(_.reduce(relevantSticks, function(memo, entry) {

				return Number(BigNumber(memo).plus(BigNumber(entry.vwap).times(BigNumber(entry.volume))).round(2));

			}, 0)).dividedBy(currentCandleStick.volume).round(2));
		}

		this.push(currentCandleStick, candleStickSize);

	}

	return candleStickArray.candleSticks;

};

storage.prototype.materialise = function(callback) {
	var candleStickArray = this.selectCollection(1);
	db.materialise(candleStickArray.candleSticks, callback);
};

storage.prototype.getDBCandles = function(callback) {
	db.getDBCandles(function(err, storageCandleSticks) {

		if(!err && storageCandleSticks) {
			this.set(storageCandleSticks);
			callback(null);
		} else {
			callback(err);
		}

	}.bind(this));
};

var candlestorage = new storage();

module.exports = candlestorage;
