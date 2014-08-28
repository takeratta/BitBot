var _ = require('underscore');
var Bitstamp = require('bitstamp-api');

var exchange = function(currencyPair, apiSettings, cbManager, q, logger) {

  this.currencyPair = currencyPair;

  this.bitstamp = new Bitstamp(apiSettings.apiKey, apiSettings.secret, apiSettings.clientId);

  this.cbManager = cbManager;

  this.q = q;

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

      this.logger.error(callerName + ': Bitstamp API returned the following error:');
      this.logger.error(parsedError.substring(0,99));

      if(retryAllowed) {
        this.logger.error('Retrying in 15 seconds!');
      }

    } else {

      this.logger.debug(callerName + ': Bitstamp API Call Result (Substring)!');
      this.logger.debug(JSON.stringify(result).substring(0,99));

    }

    cb(parsedError, result);

  }.bind(this);

};

exchange.prototype.getTrades = function(retry, cb) {

  var args = arguments;

  var wrapper = function() {

    var pair = this.currencyPair.pair;

    var handler = function(err, response) {

      if(!err) {

        var trades = _.map(response, function(t) {

          return {date: parseInt(t.date), price: parseFloat(t.price), amount: parseFloat(t.amount)};

        });

        var result = _.sortBy(trades, function(trade){ return trade.date; });

        cb(null, result);

      } else {

        cb(err, null);

      }

    };

    this.bitstamp.transactions({time: 'hour'}, this.errorHandler(this.getTrades, args, retry, 'getTrades', handler));

  }.bind(this);

  this.q.push(wrapper);

};

exchange.prototype.getBalance = function(retry, cb) {

  var args = arguments;

  var wrapper = function() {

    var asset = this.currencyPair.asset;
    var currency = this.currencyPair.currency;

    var pair = this.currencyPair.pair;

    var handler = function(err, result) {

      if(!err) {

        cb(null, {currencyAvailable:result.usd_available, assetAvailable:result.btc_available, fee:result.fee});

      } else {

        cb(err, null);

      }

    };

    this.bitstamp.balance(this.errorHandler(this.getBalance, args, retry, 'getBalance', handler));

  }.bind(this);

  this.q.push(wrapper);

};

exchange.prototype.getOrderBook = function(retry, cb) {

  var args = arguments;

  var wrapper = function () {

    var pair = this.currencyPair.pair;

    var handler = function(err, result) {

      if(!err) {

        var bids = _.map(result.bids, function(bid) {
          return {assetAmount: bid[1], currencyPrice: bid[0]};
        });

        var asks = _.map(result.asks, function(ask) {
          return {assetAmount: ask[1], currencyPrice: ask[0]};
        });

        cb(null, {bids: bids, asks: asks});

      } else {

        cb(err, null);

      }

    };

    this.bitstamp.order_book(1, this.errorHandler(this.getOrderBook, args, retry, 'getOrderBook', handler));

  }.bind(this);

  this.q.push(wrapper);

};

exchange.prototype.placeOrder = function(type, amount, price, retry, cb) {

  var args = arguments;

  var wrapper = function() {

    var pair = this.currencyPair.pair;

    var handler = function(err, result) {

      if(!err) {

        if(!result.error) {

          cb(null, {txid: result.id});

        } else {

          cb(result.error, null);

        }

      } else {

        cb(err, null);

      }

    };

    if(type === 'buy') {

      this.bitstamp.buy(amount, price, this.errorHandler(this.placeOrder, args, retry, 'placeOrder', handler));

    } else if (type === 'sell') {

      this.bitstamp.sell(amount, price, this.errorHandler(this.placeOrder, args, retry, 'placeOrder', handler));

    } else {

      cb(new Error('Invalid order type!'), null);

    }

  }.bind(this);

  this.q.push(wrapper);

};

exchange.prototype.orderFilled = function(order, retry, cb) {

  var args = arguments;

  var wrapper = function() {

    var handler = function(err, result) {

      if(!err) {

        var open = _.find(result, function(o) {

          return o.id === order;

        }, this);

        if(open) {

          cb(null, false);

        } else {

          cb(null, true);

        }

      } else {

        cb(err, null);

      }

    };

    this.bitstamp.open_orders(this.errorHandler(this.orderFilled, args, retry, 'orderFilled', handler));

  }.bind(this);

  this.q.push(wrapper);

};

exchange.prototype.cancelOrder = function(order, retry, cb) {

  var args = arguments;

  var wrapper = function() {

    var handler = function(err, result) {

      if(!err) {

        if(!result.error) {
          cb(null, true);
        } else {
          cb(null, false);
        }

      } else {

        cb(err, null);

      }

    };

    this.bitstamp.cancel_order(order,this.errorHandler(this.cancelOrder, args, retry, 'cancelOrder', handler));

  }.bind(this);

  this.q.push(wrapper);

};

module.exports = exchange;
