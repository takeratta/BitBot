var _ = require('underscore');
var BigNumber = require('bignumber.js');
var async = require('async');
var tools = require('../util/tools.js');

var processor = function(storage, logger) {

  this.initialDBWriteDone = false;
  this.storage = storage;
  this.logger = logger;

  _.bindAll(this, 'updateCandleStick', 'createBaseCandleSticks', 'processInitialLoad', 'processUpdate', 'initialize', 'updateCandleDB');

};

//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(processor, EventEmitter);
//---EventEmitter Setup

processor.prototype.updateCandleStick = function (candleStick, tick) {

  if(!candleStick.open) {

    candleStick.open = tick.price;
    candleStick.high = tick.price;
    candleStick.low = tick.price;
    candleStick.close = tick.price;
    candleStick.volume = tick.amount;
    candleStick.vwap = tick.price;

  } else {

    var currentVwap = BigNumber(candleStick.vwap).times(BigNumber(candleStick.volume));
    var newVwap = BigNumber(tick.price).times(BigNumber(tick.amount));

    candleStick.high = _.max([candleStick.high, tick.price]);
    candleStick.low = _.min([candleStick.low, tick.price]);

    candleStick.volume = Number(BigNumber(candleStick.volume).plus(BigNumber(tick.amount)).round(8));
    candleStick.vwap = Number(currentVwap.plus(newVwap).dividedBy(BigNumber(candleStick.volume)).round(2));

  }

  candleStick.close = tick.price;

  return candleStick;

};

processor.prototype.createBaseCandleSticks = function (callback) {

  var previousClose = 0;

  if(this.ticks.length > 0) {

    var candleStickSizeSeconds = 60;

    var tickTimeStamp = this.ticks[0].date;

    var lastStoragePeriod = this.storage.getLastNonEmptyPeriod();
    var firstTickCandleStick = (Math.floor(tickTimeStamp/candleStickSizeSeconds)*candleStickSizeSeconds);

    if(lastStoragePeriod < firstTickCandleStick && lastStoragePeriod !== 0) {
      tickTimeStamp = lastStoragePeriod + candleStickSizeSeconds;
    }

    var now = tools.unixTimeStamp(new Date().getTime());

    var startTimeStamp = (Math.floor(tickTimeStamp/candleStickSizeSeconds)*candleStickSizeSeconds);
    var stopTimeStamp = (Math.floor(now/candleStickSizeSeconds)*candleStickSizeSeconds);

    var endTimeStamp = startTimeStamp + candleStickSizeSeconds;

    while(endTimeStamp < this.ticks[0].date) {

      previousClose = this.storage.getLastNonEmptyClose();

      this.storage.push({'period':startTimeStamp,'open':previousClose,'high':previousClose,'low':previousClose,'close':previousClose,'volume':0, 'vwap':previousClose});

      startTimeStamp = endTimeStamp;
      endTimeStamp = endTimeStamp + candleStickSizeSeconds;

    }

    var currentCandleStick = {'period':startTimeStamp,'open':undefined,'high':undefined,'low':undefined,'close':undefined,'volume':0, 'vwap':undefined};

    this.ticks.forEach(function(tick){

      tickTimeStamp = tick.date;

      while(tickTimeStamp >= endTimeStamp + candleStickSizeSeconds) {

        if(currentCandleStick.volume > 0) {
          this.storage.push(currentCandleStick);
        }

        startTimeStamp = endTimeStamp;
        endTimeStamp = endTimeStamp + candleStickSizeSeconds;

        previousClose = this.storage.getLastNonEmptyClose();

        this.storage.push({'period':startTimeStamp,'open':previousClose,'high':previousClose,'low':previousClose,'close':previousClose,'volume':0, 'vwap':previousClose});

      }

      if(tickTimeStamp >= endTimeStamp) {

        if(currentCandleStick.volume > 0) {
          this.storage.push(currentCandleStick);
        }

        startTimeStamp = endTimeStamp;
        endTimeStamp = endTimeStamp + candleStickSizeSeconds;

        currentCandleStick = {'period':startTimeStamp,'open':undefined,'high':undefined,'low':undefined,'close':undefined,'volume':0, 'vwap':undefined};

      }

      if(tickTimeStamp >= startTimeStamp && tickTimeStamp < endTimeStamp) {

        currentCandleStick = this.updateCandleStick(currentCandleStick,tick);

      }

    }.bind(this));

    if(currentCandleStick.volume > 0) {

      this.storage.push(currentCandleStick);

      startTimeStamp = endTimeStamp;
      endTimeStamp = endTimeStamp + candleStickSizeSeconds;

    }

    for(var i = startTimeStamp;i <= stopTimeStamp;i = i + candleStickSizeSeconds) {

      var beginPeriod = i;
      var endPeriod = beginPeriod + candleStickSizeSeconds;

      previousClose = this.storage.getLastNonEmptyClose();

      this.storage.push({'period':beginPeriod,'open':previousClose,'high':previousClose,'low':previousClose,'close':previousClose,'volume':0, 'vwap':previousClose});

    }

    callback(null);

  } else {

    callback(null);

  }

};

processor.prototype.processInitialLoad = function(err, result) {

  if(err) {

    var parsedError = err;

    if(err.stack) {
      parsedError = err.stack;
    }

    this.logger.error('Couldn\'t create candlesticks due to a database error');
    this.logger.error(parsedError);

    process.exit();

  } else {

    this.emit('initialized');

  }

};

processor.prototype.processUpdate = function(err, result) {

  this.ticks = [];

  if(err) {

    var parsedError = err;

    if(err.stack) {
      parsedError = err.stack;
    }

    this.logger.error('Couldn\'t create candlesticks due to a database error');
    this.logger.error(parsedError);

    process.exit();

  } else {

    var latestCandleStick = this.storage.getLastNCandles(1)[0];

    if(!this.initialDBWriteDone) {
      this.emit('initialDBWrite');
      this.initialDBWriteDone = true;
    } else {

      this.emit('update', latestCandleStick);

    }

  }

};

processor.prototype.initialize = function() {

  async.waterfall([
    this.storage.getDBCandles
    ], this.processInitialLoad);

};

processor.prototype.updateCandleDB = function(ticks) {

  var period = this.storage.getLastNonEmptyPeriod();

  this.ticks = _.filter(ticks,function(tick){

    return tick.date >= period;

  });

  async.waterfall([
    this.createBaseCandleSticks,
    this.storage.materialise
    ], this.processUpdate);

};

module.exports = processor;
