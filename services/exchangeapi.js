var _ = require('underscore');
var async = require('async');
var fs = require('fs');

var api = function(exchangeSettings, apiSettings, logger) {

  this.exchange = exchangeSettings.exchange;
  this.currencyPair = exchangeSettings.currencyPair;
  this.logger = logger;

  this.q = async.queue(function (task, callback) {
    task();
    setTimeout(callback,1000);
  }, 1);

  if(fs.existsSync('./exchanges/' + this.exchange + '.js')) {
    var Exchange = require('../exchanges/' + this.exchange + '.js');
    this.selectedExchange = new Exchange(this.currencyPair, apiSettings[this.exchange], this.cbManager.bind(this), this.q, logger);
  } else {
    var err = new Error('Wrong exchange chosen. This exchange doesn\'t exist.');
    this.logger.error(err.stack);
    process.exit();
  }

  _.bindAll(this, 'retry', 'cbManager', 'getTrades', 'getBalance', 'getOrderBook', 'placeOrder', 'orderFilled' ,'cancelOrder');

};

api.prototype.retry = function(method, args) {

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

api.prototype.cbManager = function(method, receivedArgs, retryAllowed, cb) {

  var args = _.toArray(receivedArgs);

  return function(err, result) {

    if(err) {

      if(retryAllowed) {

        return this.retry(method, args);

      } else {

        return cb(err, null);

      }

    } else {

      cb(null, result);

    }

  }.bind(this);

};

api.prototype.getTrades = function(retry, cb) {

  this.selectedExchange.getTrades(retry, cb);

};

api.prototype.getBalance = function(retry, cb) {

  this.selectedExchange.getBalance(retry, cb);

};

api.prototype.getOrderBook = function(retry, cb) {

  this.selectedExchange.getOrderBook(retry, cb);

};

api.prototype.placeOrder = function(type, amount, price, retry, cb) {

  this.selectedExchange.placeOrder(type, amount, price, retry, cb);

};

api.prototype.orderFilled = function(order, retry, cb) {

  this.selectedExchange.orderFilled(order, retry, cb);

};

api.prototype.cancelOrder = function(order, retry, cb) {

  this.selectedExchange.cancelOrder(order, retry, cb);

};

module.exports = api;
