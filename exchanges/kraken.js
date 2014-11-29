var _ = require('underscore');
var async = require('async');
var Kraken = require('kraken-exchange-api');

var exchange = function(currencyPair, apiSettings, logger) {

  this.currencyPair = currencyPair;

  this.kraken = new Kraken(apiSettings.apiKey, apiSettings.secret);

  this.q = async.queue(function (task, callback) {
    this.logger.debug('Added ' + task.name + ' API call to the queue.');
    this.logger.debug('There are currently ' + this.q.running() + ' running jobs and ' + this.q.length() + ' jobs in queue.');
    task.func();
    setTimeout(callback,1000);
  }.bind(this), 1);

  this.logger = logger;

  _.bindAll(this, 'retry', 'errorHandler', 'getTrades', 'getBalance', 'getOrderBook', 'placeOrder', 'orderFilled' ,'cancelOrder');

};

exchange.prototype.retry = function(method, args) {

  var self = this;

  // make sure the callback (and any other fn)
  // is bound to api
  _.each(args, function(arg, i) {
    if(_.isFunction(arg))
      args[i] = _.bind(arg, self);
  });

  // run the failed method again with the same
  // arguments after wait

  setTimeout(function() { method.apply(self, args); }, 1000*15);

};

exchange.prototype.errorHandler = function(caller, receivedArgs, retryAllowed, callerName, handler) {

  return function(err, result) {

    var args = _.toArray(receivedArgs);

    var parsedError = null;

    if(err) {

      if(JSON.stringify(err) === '{}' && err.message) {
        parsedError = err.message;
      } else {
        parsedError = JSON.stringify(err);
      }

      if(parsedError === '["EQuery:Unknown asset pair"]') {

        this.logger.error(callerName + ': Kraken API returned Unknown asset pair error, exiting!');
        return process.exit();

      } else {

        this.logger.error(callerName + ': Kraken API returned the following error:');
        this.logger.error(parsedError.substring(0,99));

        if(retryAllowed) {
          this.logger.error('Retrying in 15 seconds!');
          return this.retry(caller, args);
        }

      }

    } else {

      this.logger.debug(callerName + ': Kraken API Call Result (Substring)!');
      this.logger.debug(JSON.stringify(result).substring(0,99));

    }

    handler(parsedError, result);

  }.bind(this);

};

exchange.prototype.getTrades = function(retry, cb) {

  var args = arguments;

  var wrapper = function() {

    var pair = this.currencyPair.pair;

    var handler = function(err, data) {

      if(!err) {

        var values = _.find(data.result, function(value, key) {

          return key === pair;

        });

        var trades = _.map(values, function(t) {

          return {date: parseInt(t[2]), price: parseFloat(t[0]), amount: parseFloat(t[1])};

        });

        cb(null, trades);

      } else {

        cb(err, null);

      }

    };

    this.kraken.api('Trades', {"pair": pair}, this.errorHandler(this.getTrades, args, retry, 'getTrades', handler));

  }.bind(this);

  this.q.push({name: 'getTrades', func: wrapper});

};

exchange.prototype.getBalance = function(retry, cb) {

  var args = arguments;

  var wrapper = function() {

    var asset = this.currencyPair.asset;
    var currency = this.currencyPair.currency;

    var pair = this.currencyPair.pair;

    var handler = function(err, data) {

      if(!err) {

        var assetValue = _.find(data.result, function(value, key) {
          return key === asset;
        });

        var currencyValue = _.find(data.result, function(value, key) {
          return key === currency;
        });

        if(!assetValue) {
          assetValue = 0;
        }

        if(!currencyValue) {
          currencyValue = 0;
        }

        var secondWrapper = function() {

          var secondHandler = function(err, data) {

            if(!err) {

              var fee = parseFloat(_.find(data.result.fees, function(value, key) {
                return key === pair;
              }).fee);

              cb(null, {currencyAvailable:currencyValue, assetAvailable:assetValue, fee:fee});

            } else {

              cb(err, null);

            }

          }.bind(this);

          this.kraken.api('TradeVolume', {"pair": pair}, this.errorHandler(this.getBalance, args, retry, 'getBalance', secondHandler));

        }.bind(this);

        this.q.push({name: 'TradeVolume', func: secondWrapper});

      } else {

        cb(err, null);

      }

    }.bind(this);

    this.kraken.api('Balance', {}, this.errorHandler(this.getBalance, args, retry, 'getBalance', handler));

  }.bind(this);

  this.q.push({name: 'getBalance', func: wrapper});

};

exchange.prototype.getOrderBook = function(retry, cb) {

  var args = arguments;

  var wrapper = function () {

    var pair = this.currencyPair.pair;

    var handler = function(err, data) {

      if(!err) {

        var orderbook = _.find(data.result, function(value, key) {

          return key === pair;

        });

        var bids = _.map(orderbook.bids, function(bid) {
          return {assetAmount: bid[1], currencyPrice: bid[0]};
        });

        var asks = _.map(orderbook.asks, function(ask) {
          return {assetAmount: ask[1], currencyPrice: ask[0]};
        });

        cb(null, {bids: bids, asks: asks});

      } else {

        cb(err, null);

      }

    };

    this.kraken.api('Depth', {"pair": pair}, this.errorHandler(this.getOrderBook, args, retry, 'getOrderBook', handler));

  }.bind(this);

  this.q.push({name: 'getOrderBook', func: wrapper});

};

exchange.prototype.placeOrder = function(type, amount, price, retry, cb) {

  var args = arguments;

  var wrapper = function() {

    var pair = this.currencyPair.pair;

    var handler = function(err, data) {

      if(!err) {

        cb(null, {txid: data.result.txid[0], status: 'open'});

      } else {

        cb(err, null);

      }

    };

    if(type === 'buy') {

      this.kraken.api('AddOrder', {"pair": pair, "type": 'buy', "ordertype": 'limit', "price": price, "volume": amount}, this.errorHandler(this.placeOrder, args, retry, 'placeOrder', handler));

    } else if (type === 'sell') {

      this.kraken.api('AddOrder', {"pair": pair, "type": 'sell', "ordertype": 'limit', "price": price, "volume": amount}, this.errorHandler(this.placeOrder, args, retry, 'placeOrder', handler));

    } else {

      cb(new Error('Invalid order type!'), null);

    }

  }.bind(this);

  this.q.push({name: 'placeOrder', func: wrapper});

};

exchange.prototype.orderFilled = function(order, retry, cb) {

  var args = arguments;

  var wrapper = function() {

    var handler = function(err, data) {

      if(!err) {

        var open = _.find(data.result.open, function(value, key) {

          return key === order;

        });

        if(open) {

          cb(null, false);

        } else {

          cb(null, true);

        }

      } else {

        cb(err, null);

      }

    };

    this.kraken.api('OpenOrders', {}, this.errorHandler(this.orderFilled, args, retry, 'orderFilled', handler));

  }.bind(this);

  this.q.push({name: 'orderFilled', func: wrapper});

};

exchange.prototype.cancelOrder = function(order, retry, cb) {

  var args = arguments;

  var wrapper = function() {

    this.orderFilled(order, retry, function(err, filled) {

      if(!filled && !err) {

        var handler = function(err, data) {

          if(!err) {

            if(data.result.count > 0) {
              cb(null, true);
            } else {
              cb(null, false);
            }

          } else {

            cb(err, null);

          }

        };

        this.kraken.api('CancelOrder', {"txid": order}, this.errorHandler(this.cancelOrder, args, retry, 'cancelOrder', handler));

      } else if(filled && !err) {

        cb(null, false);

      } else {

        cb(err, null);

      }

    }.bind(this));

  }.bind(this);

  this.q.push({name: 'cancelOrder', func: wrapper});

};

module.exports = exchange;
