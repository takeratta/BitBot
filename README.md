BitBot
======

BitBot is a Crypto-Currency trading bot and backtesting platform that connects to popular Bitcoin exchanges (Bitstamp, Kraken). It is written in javascript and runs on [Node.JS](http://nodejs.org).

# Dependencies

- [Node.JS](http://nodejs.org)
- [MongoDB](http://www.mongodb.org/)

# Installation

Make sure you have the latest Node.JS version and MongoDB installed.

Clone this repository to a folder of your liking and execute the following command:

	npm install

Pay close attention to the log messages of NPM (there shouldn't be any errors).

# Configuration basics

Copy the config.sample.js file and name it config.js.

Fill in the config.js file with relevant information.

When running the bot initially make sure to run with real trading disabled:

	config.tradingEnabled = false;

Choose an exchange you want to trade on in the exchangeSettings:

	exchange: '',
	// Options: (bitstamp, kraken)

Pay close attention to the currencyPair settings:

	currencyPair: {pair: '', asset: '', currency: ''},
	// For Bitstamp just use {pair: 'XBTUSD', asset: 'XBT', currency: 'USD'}
	// For Kraken look up the currency pairs in their API: https://api.kraken.com/0/public/AssetPairs
	// Kraken Example: {pair: 'XXBTZEUR', asset: 'XXBT', currency: 'ZEUR'}

Then fill in your API details:

	config.apiSettings = {
		bitstamp: {clientId: 0, apiKey: '', secret: ''},
		kraken: {apiKey: '', secret: ''}
	};

Make sure you enter the correct connection string for your MongoDB instance:

	config.mongoConnectionString = 'username:password@example.com/mydb';

If you have a local MongoDB install your connection string would probably look something like this:

	config.mongoConnectionString = 'localhost/nameofyourchoosing';

By default you will see a lot of debugging information, once you are sure that your bot is retrieving data change the debug setting to false:

	config.debug = false;

These are the minimum required settings you need to get the bot started.
All other settings are user preference and should be pretty self explanatory.

# Indicator and CandleStickSize settings

These settings aren't part of the configuration basics as they heavily depend on user preference.

Please read up on the following articles to help you choose the settings that best fit your strategy:

- [Candlesticks](http://en.wikipedia.org/wiki/Candlestick_chart)
- [MACD](http://en.wikipedia.org/wiki/MACD)

As of version 0.7 BitBot now uses indicators as small plugins. You can create your own indicator by using the following template:

	var _ = require('underscore');
	var BigNumber = require('bignumber.js');

	var indicator = function(options) {

		this.options = options;
		this.position = {};

		_.bindAll(this, 'calculate', 'setPosition');

		// indicatorOptions
		// options: {The options required for your indicator to work}

	};

	//-------------------------------------------------------------------------------HelperFunctions

		// Insert your helper functions here if needed

	//-------------------------------------------------------------------------------HelperFunctions

	indicator.prototype.calculate = function(cs) {

		// This function receives a candlestick from the trading advisor, this is the layout of a candlestick:
		// {'period':timestamp, 'open':open price, 'high':high price, 'low':low price, 'close':close price, 'volume':volume, 'vwap':volume weighted average price}

		// Insert your calculation logic here

		// When done you should always return either 'buy', 'sell' or 'hold'
		return advice;

	};

	indicator.prototype.setPosition = function(pos) {

		// This function is required and shouldn't be changed unless you know what you are doing.
		// Provides the indicator with information about the current position.
		// {pos: position, price: price}

		this.position = pos;

	};

	module.exports = indicator;

For examples on how to use this template, go have a look at one of the existing indicators in the indicators folder.

# Usage

Execute the following command in the folder where you installed BitBot:

	node app.js

If you would like to simulate trading on your collected data, execute:

	node backtester.js

Remember the backtester simulates your trading strategy on the data you collected. So the longer you keep the bot (app.js) running, the more significant the results of the backtester.

# Profitability

The provided trading algorithms are well known and documented on the internet (MADC, PPO). I do not guarantee you will make any profit when using this bot...
For better results, consider writing your own algorithm and share it with the community in a pull request :-).

# Donations

If you enjoyed using BitBot or would like to help me continue development of this bot, consider buying me a beer:  
(BTC) 1BitBotSYYMAsn6c1AsrxWphWAGkNE6hmQ
