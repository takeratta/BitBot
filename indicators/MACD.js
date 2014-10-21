var _ = require('underscore');
var tools = require('../util/tools.js');

var indicator = function(options) {

  this.options = options;
  this.position = {};
  this.indicator = {};
  this.previousIndicator = {};
  this.advice = 'hold';
  this.length = 0;

  _.bindAll(this, 'calculate', 'setPosition');

  // indicatorOptions
  // options: {neededPeriods: number, longPeriods: number, shortPeriods: number, emaPeriods: number, buyTreshold: number, sellTreshold: number}

};

//-------------------------------------------------------------------------------HelperFunctions
var calculateEma = function(periods, priceToday, previousEma) {

  if(!previousEma) {
    previousEma = priceToday;
  }

  var k = 2 / (periods + 1);
  var ema = (priceToday * k) + (previousEma * (1 - k));

  return ema;

};
//-------------------------------------------------------------------------------HelperFunctions

indicator.prototype.calculate = function(cs) {

  this.length += 1;
  this.previousIndicator = this.indicator;

  var usePrice = cs.close;

  var emaLong = calculateEma(this.options.longPeriods, usePrice, this.previousIndicator.emaLong);
  var emaShort = calculateEma(this.options.shortPeriods, usePrice, this.previousIndicator.emaShort);

  var macd = emaShort - emaLong;
  var macdSignal = calculateEma(this.options.emaPeriods, macd, this.previousIndicator.macdSignal);
  var macdHistogram = tools.round(macd - macdSignal, 2);

  this.indicator = {'emaLong': emaLong, 'emaShort': emaShort, 'macd': macd, 'macdSignal': macdSignal, 'result': macdHistogram};

  if(this.previousIndicator.result <= this.options.buyTreshold && this.indicator.result > this.options.buyTreshold) {

    this.advice = 'buy';

  } else if(this.previousIndicator.result >= this.options.sellTreshold && this.indicator.result < this.options.sellTreshold) {

    this.advice = 'sell';

  } else {

    this.advice = 'hold';

  }

  if(this.length >= this.options.neededPeriods) {

    return {advice: this.advice, indicatorValue: this.indicator.result};

  } else {

    return {advice: 'hold', indicatorValue: null};

  }

};

indicator.prototype.setPosition = function(pos) {

  this.position = pos;

};

module.exports = indicator;
