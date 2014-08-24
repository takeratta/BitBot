var _ = require('underscore');
var async = require('async');
var fs = require('fs');

var api = function(exchangeSettings, apiSettings, logger) {

  this.exchange = exchangeSettings.exchange;
  this.currencyPair = exchangeSettings.currencyPair;
  this.logger = logger;

  if(fs.existsSync('./exchanges/' + this.exchange + '.js')) {
    var Exchange = require('../exchanges/' + this.exchange + '.js');
    this.selectedExchange = new Exchange(this.currencyPair, apiSettings[this.exchange], this.cbManager.bind(this), logger);
  } else {
    var err = new Error('Wrong exchange chosen. This exchange doesn\'t exist.');
    this.logger.error(err.stack);
    process.exit();
  }

  this.q = async.queue(function (task, callback) {
    task();
    setTimeout(callback,1000);
  }, 1);

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

  var args = arguments;

  var wrapper = this.selectedExchange.getTrades(this.getTrades, args, retry, cb);

  this.q.push(wrapper);

};

api.prototype.getBalance = function(retry, cb) {

  var args = arguments;

  var wrapper = this.selectedExchange.getBalance(this.getBalance, args, retry, cb);

  this.q.push(wrapper);

};

api.prototype.getOrderBook = function(retry, cb) {

  var args = arguments;

  var wrapper = this.selectedExchange.getOrderBook(this.getOrderBook, args, retry, cb);

  this.q.push(wrapper);

};

api.prototype.placeOrder = function(type, amount, price, retry, cb) {

  var args = arguments;

  var wrapper = this.selectedExchange.placeOrder(this.placeOrder, args, type, amount, price, retry, cb);

  this.q.push(wrapper);

};

api.prototype.orderFilled = function(order, retry, cb) {

  var args = arguments;

  var wrapper = this.selectedExchange.orderFilled(this.orderFilled, args, order, retry, cb);

  this.q.push(wrapper);

};

api.prototype.cancelOrder = function(order, retry, cb) {

  var args = arguments;

  var wrapper = this.selectedExchange.cancelOrder(this.cancelOrder, args, order, retry, cb);

  this.q.push(wrapper);

};

module.exports = api;
