var _ = require('underscore');
var Kraken = require('kraken-api');

var exchange = function(currencyPair, apiSettings, cbManager, logger) {

  this.currencyPair = currencyPair;

  this.kraken = new Kraken(apiSettings.apiKey, apiSettings.secret);

  this.cbManager = cbManager;

  this.logger = logger;

  _.bindAll(this, 'errorHandler', 'getTrades', 'getBalance', 'getOrderBook', 'placeOrder', 'orderFilled' ,'cancelOrder');

};


exchange.prototype.errorHandler = function(func, receivedArgs, retryAllowed, callerName, handler) {

  return function(err, result) {

    var cb = this.cbManager(func, receivedArgs, retryAllowed, handler);

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
        }

      }

    } else {

      this.logger.debug(callerName + ': Kraken API Call Result (Substring)!');
      this.logger.debug(JSON.stringify(result).substring(0,99));

    }

    cb(parsedError, result);

  }.bind(this);

};

exchange.prototype.getTrades = function(caller, args, retry, cb) {

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

    this.kraken.api('Trades', {"pair": pair}, this.errorHandler(caller, args, retry, 'getTrades', handler));

  }.bind(this);

  return wrapper;

};

exchange.prototype.getBalance = function(caller, args, retry, cb) {

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

        this.kraken.api('TradeVolume', {"pair": pair}, this.errorHandler(caller, args, retry, 'getBalance', function(err, data) {

          if(!err) {

            var fee = parseFloat(_.find(data.result.fees, function(value, key) {
              return key === pair;
            }).fee);

            cb(null, {currencyAvailable:currencyValue, assetAvailable:assetValue, fee:fee});

          } else {

            cb(err, null);

          }

        }));

      } else {

        cb(err, null);

      }

    }.bind(this);

    this.kraken.api('Balance', {}, this.errorHandler(caller, args, retry, 'getBalance', handler));

  }.bind(this);

  return wrapper;

};

exchange.prototype.getOrderBook = function(caller, args, retry, cb) {

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

    this.kraken.api('Depth', {"pair": pair}, this.errorHandler(caller, args, retry, 'getOrderBook', handler));

  }.bind(this);

  return wrapper;

};

exchange.prototype.placeOrder = function(caller, args, type, amount, price, retry, cb) {

  var wrapper = function() {

    var pair = this.currencyPair.pair;

    var handler = function(err, data) {

      if(!err) {

        cb(null, {txid: data.result.txid[0]});

      } else {

        cb(err, null);

      }

    };

    if(type === 'buy') {

      this.kraken.api('AddOrder', {"pair": pair, "type": 'buy', "ordertype": 'limit', "price": price, "volume": amount}, this.errorHandler(caller, args, retry, 'placeOrder', handler));

    } else if (type === 'sell') {

      this.kraken.api('AddOrder', {"pair": pair, "type": 'sell', "ordertype": 'limit', "price": price, "volume": amount}, this.errorHandler(caller, args, retry, 'placeOrder', handler));

    } else {

      cb(new Error('Invalid order type!'), null);

    }

  }.bind(this);

  return wrapper;

};

exchange.prototype.orderFilled = function(caller, args, order, retry, cb) {

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

    this.kraken.api('OpenOrders', {}, this.errorHandler(caller, args, retry, 'orderFilled', handler));

  }.bind(this);

  return wrapper;

};

exchange.prototype.cancelOrder = function(caller, args, order, retry, cb) {

  var wrapper = function() {

    this.orderFilled(order, true, function(err, filled) {

      if(!filled) {

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

        this.kraken.api('CancelOrder', {"txid": order}, this.errorHandler(caller, args, retry, 'cancelOrder', handler));

      } else {

        cb(null, false);

      }

    }.bind(this));

  }.bind(this);

  return wrapper;

};

module.exports = exchange;
