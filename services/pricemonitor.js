var _ = require('underscore');
var tools = require('../util/tools.js');

var monitor = function(slPercentageB, slPercentageS, candleStickSizeMinutes, storage, logger) {

  this.percentageBought = slPercentageB;
  this.percentageSold = slPercentageS;
  this.candleStickSizeMinutes = candleStickSizeMinutes;
  this.storage = storage;
  this.logger = logger;

  this.position = 'none';

  _.bindAll(this, 'check', 'setPosition', 'update');

};

//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(monitor, EventEmitter);
//---EventEmitter Setup

monitor.prototype.check = function(price) {

  if(this.position === 'bought') {

    if(price <= this.checkPriceBought) {
      this.logger.log('Stop Loss triggered (Long Entry: ' + this.posPrice + ' Exit: ' + price + ')');
      this.position = 'none';
      this.posPrice = 0;
      this.emit('advice', 'sell');
    }

  } else if(this.position === 'sold') {

    if(price >= this.checkPriceSold) {
      this.logger.log('Stop Loss triggered (Short Entry: ' + this.posPrice + ' Exit: ' + price + ')');
      this.position = 'none';
      this.posPrice = 0;
      this.emit('advice', 'buy');
    }

  } else {

    this.emit('advice', 'hold');

  }

};

monitor.prototype.setPosition = function(pos, price) {

  if(pos === 'bought') {

    this.position = 'bought';
    this.posPrice = price;
    this.checkPriceBought = this.posPrice * (1 - (this.percentageBought / 100));

  } else if(pos === 'sold') {

    this.position = 'sold';
    this.posPrice = price;
    this.checkPriceSold = this.posPrice * (1 + (this.percentageSold / 100));

  }

};

monitor.prototype.update = function(cs, callback) {

  this.storage.getLastNCompleteAggregatedCandleSticks(10, this.candleStickSizeMinutes, function(err, completeCandleSticks) {

    var averageSize = 0;

  	if(completeCandleSticks.length > 0) {
  		averageSize = tools.floor(_.reduce(completeCandleSticks, function(memo, entry){ return memo + Math.abs(entry.close - entry.open); }, 0) / 10, 2);
  	}

    var diff = cs.close - cs.open;
    var size = Math.abs(tools.round(cs.close - cs.open, 2));

    var change = tools.round(size / 2, 2);

    var newSl;

    if(size >= averageSize * 2) {

      if(this.position === 'bought' && diff > 0) {

        newSl = tools.round(this.checkPriceBought + change, 2);

        this.logger.log('Stop loss increased! Old: ' + this.checkPriceBought + ' New: ' + newSl);

        this.checkPriceBought = newSl;

      } else if(this.position === 'sold' && diff < 0) {

        newSl = tools.round(this.checkPriceSold - change, 2);

        this.logger.log('Stop loss decreased! Old: ' + this.checkPriceSold + ' New: ' + newSl);

        this.checkPriceSold = newSl;

      }

    }

    callback(null);

  }.bind(this));

};

module.exports = monitor;
