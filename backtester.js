var _ = require('underscore');
var BigNumber = require('bignumber.js');
var moment = require('moment');

var loggingservice = require('./services/loggingservice.js');
var database = require('./services/db.js');
var candlestorage = require('./services/candlestorage.js');
var exchangeapiservice = require('./services/exchangeapi.js');
var dataprocessor = require('./services/dataprocessor.js');
var tradingadvisor = require('./services/tradingadvisor.js');
var pricemonitor = require('./services/pricemonitor.js');

//------------------------------Config
var config = require('./config.js');
//------------------------------Config

//------------------------------IntializeModules
var logger = new loggingservice(config.debug);
var db = new database(config.exchangeSettings, config.mongoConnectionString, logger);
var storage = new candlestorage(db, logger);
var exchangeapi = new exchangeapiservice(config.exchangeSettings, config.apiSettings, logger);
var processor = new dataprocessor(storage, logger);
var advisor = new tradingadvisor(config.indicatorSettings, config.candleStickSizeMinutes, true, storage, logger);
var pricemon = new pricemonitor(config.stoplossSettings.percentageBought, config.stoplossSettings.percentageSold, config.candleStickSizeMinutes, storage, logger);
//------------------------------IntializeModules

//------------------------------IntializeVariables
var candleStickSizeMinutes = config.candleStickSizeMinutes;
var stopLossEnabled = config.stoplossSettings.enabled;
var initialBalance = config.backTesting.initialBalance;
var slippagePercentage = config.exchangeSettings.slippagePercentage;
var USDBalance = initialBalance;
var BTCBalance = 0;
var initialBalanceBTC = 0;
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
console.log('------------------------------------------');
console.log('Starting BitBot Back-Tester v0.8.5');
console.log('Working Dir = ' + process.cwd());
console.log('------------------------------------------');
//------------------------------AnnounceStart

var createOrder = function(type, stopLoss) {

  var usableBalance = 0;

  if(type === 'buy' && USDBalance !== 0) {

      entryUSD = USDBalance;

      usableBalance = Number(BigNumber(USDBalance).times(BigNumber(1).minus(BigNumber(transactionFee).dividedBy(BigNumber(100)))));

      lastClosePlusSlippage = Number(BigNumber(lastClose).times(BigNumber(1).plus(BigNumber(slippagePercentage).dividedBy(BigNumber(100)))).round(2));

      totalTradedVolume = Number(BigNumber(totalTradedVolume).plus(BigNumber(usableBalance)).round(2));

      totalFeeCosts = Number(BigNumber(totalFeeCosts).plus(BigNumber(USDBalance).times(BigNumber(transactionFee).dividedBy(BigNumber(100))).round(2)));

      BTCBalance = Number(BigNumber(BTCBalance).plus(BigNumber(usableBalance).dividedBy(BigNumber(lastClosePlusSlippage)).round(2)));
      USDBalance = 0;

      var newUSDBalance = Number(BigNumber(BTCBalance).times(BigNumber(lastClosePlusSlippage)).round(2));

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

      logger.log('Placed buy order ' + BTCBalance + ' @ ' + lastClosePlusSlippage);

      pricemon.setPosition('bought', lastClosePlusSlippage);
      advisor.setPosition({pos: 'bought', price: lastClosePlusSlippage});

  } else if(type === 'sell' && BTCBalance !== 0) {

      usableBalance = Number(BigNumber(BTCBalance).times(BigNumber(1).minus(BigNumber(transactionFee).dividedBy(BigNumber(100)))));

      lastCloseMinusSlippage = Number(BigNumber(lastClose).times(BigNumber(1).minus(BigNumber(slippagePercentage).dividedBy(BigNumber(100)))).round(2));

      totalTradedVolume = Number(BigNumber(totalTradedVolume).plus(BigNumber(usableBalance).times(BigNumber(lastCloseMinusSlippage))).round(2));

      totalFeeCosts = Number(BigNumber(totalFeeCosts).plus(BigNumber(BTCBalance).times(BigNumber(transactionFee).dividedBy(BigNumber(100))).times(lastCloseMinusSlippage).round(2)));

      USDBalance = Number(BigNumber(USDBalance).plus(BigNumber(usableBalance).times(BigNumber(lastCloseMinusSlippage)).round(2)));
      BTCBalance = 0;

      if(USDBalance > highestUSDValue) {
        highestUSDValue = USDBalance;
      } else if(USDBalance < lowestUSDValue) {
        lowestUSDValue = USDBalance;
      }

      exitUSD = USDBalance;

      var tradeResult = Number(BigNumber(exitUSD).minus(BigNumber(entryUSD)).round(2));

      if(exitUSD > entryUSD) {
        winners += 1;
        totalGain = Number(BigNumber(totalGain).plus(BigNumber(tradeResult)).round(2));
        if(tradeResult > bigWinner) {bigWinner = tradeResult;}
      } else {
        losers += 1;
        totalLoss = Number(BigNumber(totalLoss).plus(BigNumber(tradeResult)).round(2));
        if(tradeResult < bigLoser) {bigLoser = tradeResult;}
      }

      transactions += 1;

      if(stopLoss) {
        slTransactions += 1;
        logger.log('Stop loss Triggered an order:');
      }

      logger.log('Placed sell order ' + usableBalance + ' @ ' + lastCloseMinusSlippage);

      pricemon.setPosition('sold', lastCloseMinusSlippage);
      advisor.setPosition({pos: 'sold', price: lastCloseMinusSlippage});

  } else {

      logger.debug('Wanted to place a ' + type + ' order @ ' + lastClose + ', but there are no more funds available to ' + type);

  }

};

processor.on('initialized', function(){

    exchangeapi.getBalance(true, function(err, result){

        transactionFee = result.fee;

        var loopArray = storage.getAllCandlesSince();
        var csArray = storage.getFinishedAggregatedCandleSticks(config.candleStickSizeMinutes);

        intialBalanceBTC = Number(BigNumber(USDBalance).dividedBy(BigNumber(_.first(loopArray).close)).round(2));

        var candleStickSizeSeconds = config.candleStickSizeMinutes * 60;

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
                if(stopLossEnabled) {
                    pricemon.update(candle);
                }
                logger.debug('Backtest: Created a new ' + config.candleStickSizeMinutes + ' minute candlestick!');
                logger.debug(JSON.stringify(candle));
                advisor.update(candle);
                if(csArray.length > 0) {
                    csPeriod = _.first(csArray).period + candleStickSizeSeconds;
                } else {
                    csPeriod = 0;
                }
            }

        });

        totalBalanceInUSD = Number(BigNumber(USDBalance).plus(BigNumber(BTCBalance).times(BigNumber(lastClose))).round(2));
        totalBalanceInBTC = Number(BigNumber(BTCBalance).plus(BigNumber(USDBalance).dividedBy(BigNumber(lastClose))).round(2));
        profit = Number(BigNumber(totalBalanceInUSD).minus(BigNumber(initialBalance)).round(2));
        profitPercentage = Number(BigNumber(profit).dividedBy(BigNumber(initialBalance)).times(BigNumber(100)).round(2));
        totalFeeCostsPercentage = Number(BigNumber(totalFeeCosts).dividedBy(BigNumber(initialBalance)).times(BigNumber(100)).round(2));
        bhProfit = Number(BigNumber(_.last(loopArray).close).minus(_.first(loopArray).open).times(BigNumber(intialBalanceBTC)).round(2));
        bhProfitPercentage = Number(BigNumber(bhProfit).dividedBy(BigNumber(initialBalance)).times(BigNumber(100)).round(2));

        startDate = moment(new Date(_.first(loopArray).period*1000)).format('DD-MM-YYYY HH:mm:ss');
        endDate = moment(new Date(_.last(loopArray).period*1000)).format('DD-MM-YYYY HH:mm:ss');

        averageGain = Number(BigNumber(totalGain).dividedBy(winners).round(2));
        averageLoss = Number(BigNumber(totalLoss).dividedBy(losers).round(2));

        logger.log('----------Report----------');
        logger.log('Transaction Fee: ' + transactionFee + '%');
        logger.log('Initial Balance: ' + initialBalance);
        logger.log('Initial Balance BTC: ' + intialBalanceBTC);
        logger.log('Final Balance: ' + totalBalanceInUSD);
        logger.log('Final Balance BTC: ' + totalBalanceInBTC);
        logger.log('Winning trades : ' + winners + ' Losing trades: ' + losers);
        logger.log('Biggest winner: ' + bigWinner + ' Biggest loser: ' + bigLoser);
        logger.log('Average winner: ' + averageGain + ' Average loser: ' + averageLoss);
        logger.log('Profit: ' + profit + ' (' + profitPercentage + '%)');
        logger.log('Buy and Hold Profit: ' + bhProfit + ' (' + bhProfitPercentage + '%)');
        logger.log('Lost on fees: ' + totalFeeCosts + ' (' + totalFeeCostsPercentage + '%)');
        logger.log('Total traded volue: ' + totalTradedVolume);
        logger.log('Highest - Lowest USD Balance: ' + highestUSDValue + ' - ' + lowestUSDValue);
        logger.log('Open Price: ' + _.first(loopArray).open);
        logger.log('Close Price: ' + _.last(loopArray).close);
        logger.log('Start - End Date: ' + startDate + ' - ' + endDate);
        logger.log('Transactions: ' + transactions);
        logger.log('Stop Loss Transactions: ' + slTransactions);
        logger.log('--------------------------');

    });

});

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

processor.initialize();
