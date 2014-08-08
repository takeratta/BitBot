var _ = require('underscore');
var BigNumber = require('bignumber.js');

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

  var k = BigNumber(2).dividedBy(BigNumber(periods+1));
  var ema = (BigNumber(priceToday).times(k)).plus(BigNumber(previousEma).times(BigNumber(1).minus(k)));

  return BigNumber(ema).round(8);

};
//-------------------------------------------------------------------------------HelperFunctions

indicator.prototype.calculate = function(cs) {

  this.length += 1;
  this.previousIndicator = this.indicator;

  var usePrice = cs.close;

  var emaLong = Number(calculateEma(this.options.longPeriods, usePrice, this.previousIndicator.emaLong));
  var emaShort = Number(calculateEma(this.options.shortPeriods, usePrice, this.previousIndicator.emaShort));

  var PPO = Number(BigNumber(emaShort).minus(BigNumber(emaLong)).dividedBy(BigNumber(emaLong)).times(BigNumber(100)).round(8));
  var PPOSignal = Number(calculateEma(this.options.emaPeriods, PPO, this.previousIndicator.PPOSignal));
  var PPOHistogram = Number(BigNumber(PPO).minus(BigNumber(PPOSignal)).round(2));

  this.indicator = {'emaLong': emaLong, 'emaShort': emaShort, 'PPO': PPO, 'PPOSignal': PPOSignal, 'result': PPOHistogram};

  if(this.previousIndicator.result <= this.options.buyTreshold && this.indicator.result > this.options.buyTreshold) {

    this.advice = 'buy';

  } else if(this.previousIndicator.result >= this.options.sellTreshold && this.indicator.result < this.options.sellTreshold) {

    this.advice = 'sell';

  } else {

    this.advice = 'hold';

  }

  if(this.length >= this.options.neededPeriods) {

    return this.advice;

  } else {

    return 'hold';

  }

};

indicator.prototype.setPosition = function(pos) {

  this.position = pos;

};

module.exports = indicator;
