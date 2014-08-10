var _ = require('underscore');
var BigNumber = require('bignumber.js');

var indicator = function(options) {

  this.options = options;
  this.position = {};
  this.csArray = [];
  this.firstCandleDone = false;

  _.bindAll(this, 'calculate', 'setPosition');

  // indicatorOptions
  // options: {AFIncrement: number, maximumAF: number}

};

//-------------------------------------------------------------------------------HelperFunctions

var calculatePSAR = function(previousPSAR, previousEP, previousAF, previousTrend, limit) {

  var PSAR;
  var temp;

  if(previousTrend === 1) {
    temp = Number(BigNumber(previousPSAR).plus(BigNumber(previousAF).times(BigNumber(previousEP).minus(BigNumber(previousPSAR)))).round(2));
    PSAR = _.min([temp, limit]);
  } else if (previousTrend === -1) {
    temp = Number(BigNumber(previousPSAR).minus(BigNumber(previousAF).times(BigNumber(previousPSAR).minus(BigNumber(previousEP)))).round(2));
    PSAR = _.max([temp,limit]);
  }

  return PSAR;

};

var calculateTrend = function(previousTrend, PSAR, cs) {

  var trend;

  if(PSAR < cs.low) {
    trend = 1;
  } else if (PSAR > cs.high) {
    trend = -1;
  } else {
    if (previousTrend === 1) { trend = -1;}
    else { trend = 1;}
  }

  return trend;

};

var calculateLimit = function(previousTrend, arr) {

  var limit;

  var lowArr = [arr[0].low, arr[1].low];
  var highArr = [arr[0].high, arr[1].high];

  if(previousTrend === 1) {
    limit = _.min(lowArr);
  } else if (previousTrend === -1) {
    limit = _.max(highArr);
  }

  return limit;

};

var calculateEP = function(previousEP, trend, cs) {

  var EP;

  if(trend === 1) {
    EP = _.max([cs.high,previousEP]);
  } else if (trend === -1) {
    EP = _.min([cs.low,previousEP]);
  } else {
    EP = previousEP;
  }

  return EP;

};

var calculateAF = function(EP, previousEP, trend, previousTrend, previousAF, AFIncrement, maximumAF) {

  var AF;

  var EPChanged = false;

  if(EP !== previousEP) {EPChanged = true;}

  if(EPChanged && trend === previousTrend && previousAF < maximumAF) {
    AF = Number(BigNumber(previousAF).plus(BigNumber(AFIncrement)).round(2));
  } else if (trend !== previousTrend) {
    AF = AFIncrement;
  } else {
    AF = previousAF;
  }

  return AF;

};

//-------------------------------------------------------------------------------HelperFunctions

indicator.prototype.calculate = function(cs) {

  var limit, PSAR, trend, EP, AF;

  this.csArray.push(cs);
  if(this.csArray.length > 3) {
    this.csArray.shift();
  }

  if(!this.firstCandleDone) {
    this.previousPSAR = Number(BigNumber(cs.low).round(2));
    this.previousEP = Number(BigNumber(cs.high).round(2));
    this.previousAF = this.options.AFIncrement;
    this.previousTrend = 1;
    this.firstCandleDone = true;
    return 'hold';
  }

  limit = calculateLimit(this.previousTrend, this.csArray);
  PSAR = calculatePSAR(this.previousPSAR, this.previousEP, this.previousAF, this.previousTrend, limit);
  trend = calculateTrend(this.previousTrend, PSAR, cs);
  if (trend !== this.previousTrend) {
    limit = calculateLimit(trend, this.csArray);
    this.previousPSAR = this.previousEP;
    if(trend === 1) {
      this.previousEP = cs.high;
    } else {
      this.previousEP = cs.low;
    }
    this.previousAF = this.options.AFIncrement;
    PSAR = calculatePSAR(this.previousPSAR, this.previousEP, this.previousAF, trend, limit);
  }
  EP = calculateEP(this.previousEP, trend, cs);
  AF = calculateAF(EP, this.previousEP, trend, this.previousTrend, this.previousAF, this.options.AFIncrement, this.options.maximumAF);

  cs.psar = PSAR;

  var advice;

  if(trend !== this.previousTrend) {
    if(trend === 1) {
      advice = 'buy';
    } else if(trend === -1) {
      advice = 'sell';
    } else {
      advice = 'hold';
    }
  } else {
    advice = 'hold';
  }

  this.previousPSAR = PSAR;
  this.previousEP = EP;
  this.previousAF = AF;
  this.previousTrend = trend;

  return advice;

};

indicator.prototype.setPosition = function(pos) {

  this.position = pos;

};

module.exports = indicator;
