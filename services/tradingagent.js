var _ = require('underscore');
var tools = require('../util/tools.js');
var async = require('async');

var agent = function(tradingEnabled, exchangeSettings, storage, exchangeapi, logger) {

	_.bindAll(this, 'order', 'calculateOrder', 'placeRealOrder', 'placeSimulatedOrder', 'processOrder');

  this.tradingEnabled = tradingEnabled;
  this.currencyPair = exchangeSettings.currencyPair;
  this.tradingReserveAsset = exchangeSettings.tradingReserveAsset;
  this.tradingReserveCurrency = exchangeSettings.tradingReserveCurrency;
  this.slippagePercentage = exchangeSettings.slippagePercentage;
	this.storage = storage;
	this.exchangeapi = exchangeapi;
	this.logger = logger;

};

//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(agent, EventEmitter);
//---EventEmitter Setup

agent.prototype.order = function(orderType) {

	this.orderDetails = {};

	this.orderDetails.orderType = orderType;

	var process = function (err, result) {

		//No need to test on error as it's handled by the errorhandler
		this.calculateOrder(result);

		if(this.tradingEnabled) {
			this.placeRealOrder();
		} else {
			this.placeSimulatedOrder();
		}

	};

	async.series(
		{
			balance: function(cb) {this.exchangeapi.getBalance(true, cb);}.bind(this),
			orderBook: function(cb) {this.exchangeapi.getOrderBook(true, cb);}.bind(this),
			lastClose: function(cb) {this.storage.getLastClose(cb);}.bind(this)
		},
		process.bind(this)
	);

};

agent.prototype.calculateOrder = function(result) {

	this.orderDetails.assetBalance = parseFloat(result.balance.assetAvailable);
	this.orderDetails.currencyBalance = parseFloat(result.balance.currencyAvailable);
	this.orderDetails.tradingFee = parseFloat(result.balance.fee);

	var orderBook = result.orderBook;

	var lastClose = result.lastClose;
	var minClose = tools.round(lastClose * 0.9975, 2);
	var maxClose = tools.round(lastClose * 1.0025, 2);

	this.logger.log('Preparing to place a ' + this.orderDetails.orderType + ' order! (' + this.currencyPair.asset + ' Balance: ' + this.orderDetails.assetBalance + ' ' + this.currencyPair.currency + ' Balance: ' + this.orderDetails.currencyBalance + ' Trading Fee: ' + this.orderDetails.tradingFee +')');

	if(this.orderDetails.orderType === 'buy') {

		//var lowestAsk = _.first(orderBook.asks)[0];
		/*var lowestAsk = _.min(orderBook.asks, function(ask){ return parseFloat(ask[0]); })[0];

		if(lowestAsk < minClose) {
			lowestAsk = minClose;
		} else if(lowestAsk > lastClose) {
			lowestAsk = lastClose;
		}*/

		var lowestAsk = lastClose;

		var lowestAskWithSlippage = tools.round(lowestAsk * (1 + (this.slippagePercentage / 100)), 2);
		var balance = (this.orderDetails.currencyBalance - this.tradingReserveCurrency) * (1 - (this.orderDetails.tradingFee / 100));

		this.logger.log('Lowest Ask: ' + lowestAsk + ' Lowest Ask With Slippage: ' + lowestAskWithSlippage);

		this.orderDetails.price = lowestAskWithSlippage;
		this.orderDetails.amount = tools.round((balance / this.orderDetails.price) - 0.005, 2);

	} else if(this.orderDetails.orderType === 'sell') {

		//var highestBid = _.first(orderBook.bids)[0];
		/*var highestBid = _.max(orderBook.bids, function(bid){ return parseFloat(bid[0]); })[0];

		if(highestBid > maxClose) {
			highestBid = maxClose;
		} else if(highestBid < lastClose) {
			highestBid = lastClose;
		}*/

		var highestBid = lastClose;

		var highestBidWithSlippage = tools.round(highestBid * (1 - (this.slippagePercentage / 100)), 2);

		this.logger.log('Highest Bid: ' + highestBid + ' Highest Bid With Slippage: ' + highestBidWithSlippage);

		this.orderDetails.price = highestBidWithSlippage;
		this.orderDetails.amount = tools.round(this.orderDetails.assetBalance - this.tradingReserveAsset, 2);

	}

};

agent.prototype.placeRealOrder = function() {

	if(this.orderDetails.amount <= 0) {

		this.logger.log('Insufficient funds to place an order.');

	} else {

		this.exchangeapi.placeOrder(this.orderDetails.orderType, this.orderDetails.amount, this.orderDetails.price, true, this.processOrder);

	}

};

agent.prototype.placeSimulatedOrder = function() {

	if(this.orderDetails.amount <= 0) {

		this.logger.log('Insufficient funds to place an order.');

	} else {

		this.orderDetails.order = 'Simulated';

		this.logger.log('Placed simulated ' + this.orderDetails.orderType + ' order: (' + this.orderDetails.amount + '@' + this.orderDetails.price + ')');

		this.emit('simulatedOrder', this.orderDetails);

	}

};

agent.prototype.processOrder = function(err, order) {

	if(!order) {

		this.logger.log('Something went wrong when placing the ' + this.orderDetails.orderType + ' order.');

	} else {

		this.orderDetails.order = order.txid;

		this.logger.log('Placed ' + this.orderDetails.orderType + ' order: ' + this.orderDetails.order + ' (' + this.orderDetails.amount + '@' + this.orderDetails.price + ')');

		this.emit('realOrder', this.orderDetails);

	}

};

module.exports = agent;
