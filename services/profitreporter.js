var _ = require('underscore');
var tools = require('../util/tools.js');
var async = require('async');

var reporter = function(currencyPair, storage, exchangeapi, logger) {

  this.currencyPair = currencyPair;
  this.storage = storage;
  this.exchangeapi = exchangeapi;
  this.logger = logger;

  _.bindAll(this, 'intialize', 'createReport', 'processBalance', 'start', 'updateBalance');

};

//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(reporter, EventEmitter);
//---EventEmitter Setup

reporter.prototype.intialize = function(err, result) {

  this.currencyBalance = parseFloat(result.balance.currencyAvailable);
  this.assetBalance = tools.round(parseFloat(result.balance.assetAvailable), 8);

  this.highestBid = _.first(result.orderBook.bids).currencyPrice;
  this.assetBalanceInCurrency = this.assetBalance * this.highestBid;

  this.initalTotalCurrencyBalance = tools.round(this.currencyBalance + this.assetBalanceInCurrency, 8);

  this.storage.setInitialBalance(this.initalTotalCurrencyBalance, function(err) {

    if(err) {

      this.logger.error('Couldn\'t get initialBalance due to a database error');
      this.logger.error(err.stack);

      process.exit();

    } else {

      if(this.resetInitialBalances) {
        this.logger.log(this.currencyPair.pair + ' Balance reset successfully, change the configuration setting back to false and restart the application.');
        process.exit();
      }

    }

  }.bind(this));

};

reporter.prototype.createReport = function() {

  var report = this.currencyPair.asset + ': ' + this.assetBalance + ' ' + this.currencyPair.currency + ': ' + this.currencyBalance + ' Total in ' + this.currencyPair.currency + ': ' + this.totalCurrencyBalance + ' Profit: ' + this.profitAbsolute + ' (' + this.profitPercentage + '%)';

  this.logger.log('Profit Report: ' + report);

  this.emit('report', report);

};

reporter.prototype.processBalance = function(err, result) {

  this.currencyBalance = parseFloat(result.balance.currencyAvailable);
  this.assetBalance = tools.round(parseFloat(result.balance.assetAvailable), 8);

  this.highestBid = _.first(result.orderBook.bids).currencyPrice;
  this.assetBalanceInCurrency = this.assetBalance * this.highestBid;

  this.totalCurrencyBalance = tools.round(this.currencyBalance + this.assetBalanceInCurrency, 8);
  this.profitAbsolute = this.totalCurrencyBalance - this.initalTotalCurrencyBalance;
  this.profitPercentage = tools.round((this.profitAbsolute / this.initalTotalCurrencyBalance) * 100, 8);

  if(this.includeReport) {
    this.createReport();
  }

};

reporter.prototype.start = function(resetInitialBalances) {

  this.resetInitialBalances = resetInitialBalances;

  this.storage.getInitialBalance(function(err, result) {

    if(err) {

      this.logger.error('Couldn\'t get initialBalance due to a database error');
      this.logger.error(err.stack);

      process.exit();

    } else {

      if(result && !resetInitialBalances) {

        this.initalTotalCurrencyBalance = result;

      } else {

        async.series(
          {
            balance: function(cb) {this.exchangeapi.getBalance(true, cb);}.bind(this),
            orderBook: function(cb) {this.exchangeapi.getOrderBook(true, cb);}.bind(this)
          },
          this.intialize
        );

      }

    }

  }.bind(this));

};

reporter.prototype.updateBalance = function(includeReport) {

  this.includeReport = includeReport;

  async.series(
    {
      balance: function(cb) {this.exchangeapi.getBalance(true, cb);}.bind(this),
      orderBook: function(cb) {this.exchangeapi.getOrderBook(true, cb);}.bind(this)
    },
    this.processBalance
  );

};

module.exports = reporter;
