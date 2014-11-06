var _ = require('underscore');
var tools = require('./util/tools.js');
var moment = require('moment');
var async = require('async');

var loggingservice = require('./services/loggingservice.js');
var storageservice = require('./services/storage.js');
var exchangeapiservice = require('./services/exchangeapi.js');
var dataprocessor = require('./services/dataprocessor.js');
var tradingadvisor = require('./services/tradingadvisor.js');
var pricemonitor = require('./services/pricemonitor.js');

//------------------------------Config
var config = require('./config.js');
//------------------------------Config

//------------------------------IntializeModules
var logger = new loggingservice('backtester', config.debug);
var storage = new storageservice(config.exchangeSettings, config.mongoConnectionString, logger);
var exchangeapi = new exchangeapiservice(config.exchangeSettings, config.apiSettings, logger);
var processor = new dataprocessor(storage, logger);
var advisor = new tradingadvisor(config.indicatorSettings, true, storage, logger);
var pricemon = new pricemonitor(config.stoplossSettings.percentageBought, config.stoplossSettings.percentageSold, config.indicatorSettings.candleStickSizeMinutes, storage, logger);
//------------------------------IntializeModules

//------------------------------IntializeVariables
var exchange = config.exchangeSettings.exchange;
var asset = config.exchangeSettings.currencyPair.asset;
var currency = config.exchangeSettings.currencyPair.currency;
var candleStickSizeMinutes = config.indicatorSettings.candleStickSizeMinutes;
var stopLossEnabled = config.stoplossSettings.enabled;
var initialAssetBalance = config.backTesting.initialAssetBalance;
var initialCurrencyBalance = config.backTesting.initialCurrencyBalance;
var slippagePercentage = config.exchangeSettings.slippagePercentage;
var USDBalance = initialCurrencyBalance;
var BTCBalance = initialAssetBalance;
var initialBalanceSumInBTC = 0;
var initialBalanceSumInUSD = 0;
var totalBalanceInUSD = 0;
var totalBalanceInBTC = 0;
var profit = 0;
var profitPercentage = 0;
var bhProfit = 0;
var bhProfitPercentage = 0;
var transactionFee = 0;
var totalTradedVolume = 0;
var highestUSDValue = 0;
var lowestUSDValue = USDBalance;
var totalFeeCosts = 0;
var totalFeeCostsPercentage = 0;
var transactions = 0;
var slTransactions = 0;
var latestCandlePeriod;
var lastClose = 0;
var lastClosePlusSlippage = 0;
var lastCloseMinusSlippage = 0;
var csPeriod = 0;
var entryUSD = 0;
var exitUSD = 0;
var winners = 0;
var losers = 0;
var bigWinner = 0;
var bigLoser = 0;
var totalGain = 0;
var totalLoss = 0;
var averageGain = 0;
var averageLoss = 0;
var startDate;
var endDate;
//------------------------------IntializeVariables

//------------------------------AnnounceStart
logger.log('------------------------------------------');
logger.log('Starting BitBot Back-Tester v0.9.3');
logger.log('Working Dir = ' + process.cwd());
logger.log('------------------------------------------');
//------------------------------AnnounceStart

var createOrder = function(type, stopLoss) {

  var usableBalance = 0;

  if(type === 'buy' && USDBalance !== 0) {

    entryUSD = USDBalance;

    usableBalance = USDBalance * (1 - (transactionFee / 100));

    lastClosePlusSlippage = tools.round(lastClose * (1 + (slippagePercentage / 100)), 2);

    totalTradedVolume = tools.round(totalTradedVolume + usableBalance, 2);

    totalFeeCosts = tools.round(totalFeeCosts + (USDBalance * (transactionFee / 100)), 2);

    BTCBalance = tools.round(BTCBalance + (usableBalance / lastClosePlusSlippage), 2);
    USDBalance = 0;

    var newUSDBalance = tools.round(BTCBalance * lastClosePlusSlippage, 2);

    if(newUSDBalance > highestUSDValue) {
      highestUSDValue = newUSDBalance;
    } else if(newUSDBalance < lowestUSDValue) {
      lowestUSDValue = newUSDBalance;
    }

    transactions += 1;

    if(stopLoss) {
      slTransactions += 1;
      logger.log('Stop loss Triggered an order:');
    }

    logger.log(new Date(latestCandlePeriod * 1000) + ' Placed buy order ' + BTCBalance + ' @ ' + lastClosePlusSlippage);

    pricemon.setPosition('bought', lastClosePlusSlippage);
    advisor.setPosition({pos: 'bought', price: lastClosePlusSlippage});

  } else if(type === 'sell' && BTCBalance !== 0) {

    usableBalance = BTCBalance * (1 - (transactionFee / 100));

    lastCloseMinusSlippage = tools.round(lastClose * (1 - (slippagePercentage / 100)), 2);

    totalTradedVolume = tools.round(totalTradedVolume + (usableBalance * lastCloseMinusSlippage), 2);

    totalFeeCosts = tools.round(totalFeeCosts + (BTCBalance * (transactionFee / 100) * lastCloseMinusSlippage), 2);

    USDBalance = tools.round(USDBalance + (usableBalance * lastCloseMinusSlippage), 2);
    BTCBalance = 0;

    if(USDBalance > highestUSDValue) {
      highestUSDValue = USDBalance;
    } else if(USDBalance < lowestUSDValue) {
      lowestUSDValue = USDBalance;
    }

    exitUSD = USDBalance;

    if(entryUSD > 0) {

      var tradeResult = tools.round(exitUSD - entryUSD, 2);

      if(exitUSD > entryUSD) {
        winners += 1;
        totalGain = tools.round(totalGain + tradeResult, 2);
        if(tradeResult > bigWinner) {bigWinner = tradeResult;}
      } else {
        losers += 1;
        totalLoss = tools.round(totalLoss + tradeResult, 2);
        if(tradeResult < bigLoser) {bigLoser = tradeResult;}
      }

    }

    transactions += 1;

    if(stopLoss) {
      slTransactions += 1;
      logger.log('Stop loss Triggered an order:');
    }

    logger.log(new Date(latestCandlePeriod * 1000) + ' Placed sell order ' + usableBalance + ' @ ' + lastCloseMinusSlippage);

    pricemon.setPosition('sold', lastCloseMinusSlippage);
    advisor.setPosition({pos: 'sold', price: lastCloseMinusSlippage});

  } else {

    logger.debug('Wanted to place a ' + type + ' order @ ' + lastClose + ', but there are no more funds available to ' + type);

  }

};

var calculate = function(err, result) {

  transactionFee = result.balance.fee;

  var loopArray = result.dbCandleSticks;
  var csArray = result.aggregatedCandleSticks;

  if(loopArray.length > 0) {

    initialBalanceSumInBTC = BTCBalance + tools.round(USDBalance / _.first(loopArray).close, 2);
    initialBalanceSumInUSD = USDBalance + tools.round(BTCBalance * _.first(loopArray).close, 2);

    var candleStickSizeSeconds = candleStickSizeMinutes * 60;

    if(csArray.length > 0) {

        csPeriod = _.first(csArray).period + candleStickSizeSeconds;

    }

    _.each(loopArray, function(cs) {

      lastClose = cs.close;

      if(stopLossEnabled) {
          pricemon.check(cs.close);
      }

      if(cs.period + 60 === csPeriod) {

          var candle = csArray.shift();
          latestCandlePeriod = candle.period;
          if(csArray.length > 0) {
              csPeriod = _.first(csArray).period + candleStickSizeSeconds;
          } else {
              csPeriod = 0;
          }

          if(stopLossEnabled) {

            pricemon.update(candle, function(err) {

              logger.debug('Backtest: Created a new ' + candleStickSizeMinutes + ' minute candlestick!');
              logger.debug(JSON.stringify(candle));
              advisor.update(candle);

            });

          } else {

            logger.debug('Backtest: Created a new ' + candleStickSizeMinutes + ' minute candlestick!');
            logger.debug(JSON.stringify(candle));
            advisor.update(candle);

          }

      }

    });

    report(_.first(loopArray), _.last(loopArray));

  } else {

    logger.log('No data available to run backtester on.');

  }

};

var report = function(firstCs, lastCs) {

  totalBalanceInUSD = tools.round(USDBalance + (BTCBalance * lastClose), 2);
  totalBalanceInBTC = tools.round(BTCBalance + (USDBalance / lastClose), 2);
  profit = tools.round(totalBalanceInUSD - initialBalanceSumInUSD, 2);
  profitPercentage = tools.round(profit / initialBalanceSumInUSD * 100, 2);
  totalFeeCostsPercentage = tools.round(totalFeeCosts / initialBalanceSumInUSD * 100, 2);
  bhProfit = tools.round((lastCs.close - firstCs.open) * initialBalanceSumInBTC, 2);
  bhProfitPercentage = tools.round(bhProfit / initialBalanceSumInUSD * 100, 2);

  if(totalBalanceInUSD > highestUSDValue) {
    highestUSDValue = totalBalanceInUSD;
  }

  startDate = moment(new Date(firstCs.period*1000)).format('DD-MM-YYYY HH:mm:ss');
  endDate = moment(new Date(lastCs.period*1000)).format('DD-MM-YYYY HH:mm:ss');

  averageGain = tools.round(totalGain / winners, 2);
  averageLoss = tools.round(totalLoss / losers, 2);

  logger.log('----------Report----------');
  logger.log('Exchange: ' + exchange);
  logger.log('Transaction Fee: ' + transactionFee + '%');
  logger.log('Initial ' + asset + ' Balance: ' + initialAssetBalance);
  logger.log('Initial ' + currency + ' Balance: ' + initialCurrencyBalance);
  logger.log('Final ' + asset + ' Balance: ' + BTCBalance);
  logger.log('Final ' + currency + ' Balance: ' + USDBalance);
  logger.log('Total Initial Balance in ' + currency + ': ' + initialBalanceSumInUSD);
  logger.log('Total Initial Balance in ' + asset + ': ' + initialBalanceSumInBTC);
  logger.log('Total Final Balance in ' + currency + ': ' + totalBalanceInUSD);
  logger.log('Total Final Balance in ' + asset + ': ' + totalBalanceInBTC);
  logger.log('Winning trades : ' + winners + ' Losing trades: ' + losers);
  logger.log('Biggest winner: ' + bigWinner + ' Biggest loser: ' + bigLoser);
  logger.log('Average winner: ' + averageGain + ' Average loser: ' + averageLoss);
  logger.log('Profit: ' + profit + ' (' + profitPercentage + '%)');
  logger.log('Buy and Hold Profit: ' + bhProfit + ' (' + bhProfitPercentage + '%)');
  logger.log('Lost on fees: ' + totalFeeCosts + ' (' + totalFeeCostsPercentage + '%)');
  logger.log('Total traded volue: ' + totalTradedVolume);
  logger.log('Highest - Lowest ' + currency + ' Balance: ' + highestUSDValue + ' - ' + lowestUSDValue);
  logger.log('Open Price: ' + firstCs.open);
  logger.log('Close Price: ' + lastCs.close);
  logger.log('Start - End Date: ' + startDate + ' - ' + endDate);
  logger.log('Transactions: ' + transactions);
  logger.log('Stop Loss Transactions: ' + slTransactions);
  logger.log('--------------------------');

};

var start = function() {
  async.series(
    {
      balance: function(cb) {exchangeapi.getBalance(true, cb);},
      dbCandleSticks: function(cb) {storage.getAllCandlesSince(0, cb);},
      aggregatedCandleSticks: function(cb) {storage.getAggregatedCandleSticks(candleStickSizeMinutes, cb);}
    },
    calculate
  );
};

advisor.on('advice', function(advice){

  if(advice !== 'hold') {
    createOrder(advice);
  }

});

pricemon.on('advice', function(advice) {

  if(advice !== 'hold') {
    createOrder(advice, true);
  }

});

start();
