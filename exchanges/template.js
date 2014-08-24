//-------------------- REMOVE THIS BLOCK
console.log('If you want this code to do anything, remove this code block!');
process.exit();
//-------------------- REMOVE THIS BLOCK

var _ = require('underscore');

var exchange = function(currencyPair, apiSettings, cbManager, logger) {

  this.currencyPair = currencyPair;

  // intialize your API with it's apiSettings here

  this.cbManager = cbManager;

  this.logger = logger;

  _.bindAll(this, 'errorHandler', 'getTrades', 'getBalance', 'getOrderBook', 'placeOrder', 'orderFilled' ,'cancelOrder');

};

exchange.prototype.errorHandler = function(func, receivedArgs, retryAllowed, callerName, handler) {

  return function(err, result) {

    var cb = this.cbManager(func, receivedArgs, retryAllowed, callerName, handler);

    var parsedError = null;

    if(err) {

      if(JSON.stringify(err) === '{}' && err.message) {
        parsedError = err.message;
      } else {
        parsedError = JSON.stringify(err);
      }

      this.logger.error(callerName + ' Exchange API returned the following error:');
      this.logger.error(parsedError.substring(0,99));

      if(retryAllowed) {
        this.logger.error('Retrying in 15 seconds!');
      }

    } else {

      this.logger.debug(callerName + ' Exchange API Call Result (Substring)!');
      this.logger.debug(JSON.stringify(result).substring(0,99));

    }

    cb(parsedError, result);

  }.bind(this);

};

exchange.prototype.getTrades = function(caller, retry, cb) {

  var args = arguments;

  var wrapper = function() {

    var handler = function(err, response) {

      cb(null, {date: timestamp, price: number, amount: number});

    };

    // Pass this as callback to your exchange function (Expects an Err, Result output).
    this.errorHandler(caller, args, retry, 'getTrades', handler);

  }.bind(this);

  return wrapper;

};

exchange.prototype.getBalance = function(caller, retry, cb) {

  var args = arguments;

  var wrapper = function() {

    var handler = function(err, response) {

      cb(null, {currencyAvailable: number, assetAvailable: number, fee: number});

    };

    // Pass this as callback to your exchange function (Expects an Err, Result output).
    this.errorHandler(caller, args, retry, 'getBalance', handler);

  }.bind(this);

  return wrapper;

};

exchange.prototype.getOrderBook = function(caller, retry, cb) {

  var args = arguments;

  var wrapper = function() {

    var handler = function(err, response) {

      cb(null, {bids: [{assetAmount: number, currencyPrice: number}], asks: [{assetAmount: number, currencyPrice: number}]});

    };

    // Pass this as callback to your exchange function (Expects an Err, Result output).
    this.errorHandler(caller, args, retry, 'getOrderBook', handler);

  }.bind(this);

  return wrapper;

};

exchange.prototype.placeOrder = function(caller, type, amount, price, retry, cb) {

  var args = arguments;

  var wrapper = function() {

    var handler = function(err, response) {

      cb(null, {txid: transaction_id});

    };

    // Pass this as callback to your exchange function (Expects an Err, Result output).
    this.errorHandler(caller, args, retry, 'placeOrder', handler);

  }.bind(this);

  return wrapper;

};

exchange.prototype.orderFilled = function(caller, order, retry, cb) {

  var args = arguments;

  var wrapper = function() {

    var handler = function(err, response) {

      cb(null, boolean);

    };

    // Pass this as callback to your exchange function (Expects an Err, Result output).
    this.errorHandler(caller, args, retry, 'orderFilled', handler);

  }.bind(this);

  return wrapper;

};

exchange.prototype.cancelOrder = function(caller, order, retry, cb) {

  var args = arguments;

  var wrapper = function() {

    var handler = function(err, response) {

      cb(null, boolean);

    };

    // Pass this as callback to your exchange function (Expects an Err, Result output).
    this.errorHandler(caller, args, retry, 'cancelOrder', handler);

  }.bind(this);

  return wrapper;

};

module.exports = exchange;
