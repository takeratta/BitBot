var tools = function() {


};

tools.prototype.unixTimeStamp = function(timestamp) {
  return Math.floor(timestamp/1000);
};

tools.prototype.getRandomInt = function(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

tools.prototype.getRandomArbitrary = function(decimals, min, max) {
  return (Math.random() * (max - min) + min).toFixed(decimals);
};

tools.prototype.round = function(value, decimals) {
  // Shift
  value = value.toString().split('e');
  value = Math.round(+(value[0] + 'e' + (value[1] ? (+value[1] + decimals) : decimals)));
  // Shift back
  value = value.toString().split('e');
  return Number((value[0] + 'e' + (value[1] ? (+value[1] - decimals) : -decimals)));
};

tools.prototype.floor = function(value, decimals) {
  // Shift
  value = value.toString().split('e');
  value = Math.floor(+(value[0] + 'e' + (value[1] ? (+value[1] + decimals) : decimals)));
  // Shift back
  value = value.toString().split('e');
  return Number((value[0] + 'e' + (value[1] ? (+value[1] - decimals) : -decimals)));
};

tools.prototype.rangeToArray = function(range) {

  var result = [];
  var increment = this.floor(1 / Math.pow(10,range[0]), range[0]);

  for(var i = range[1]; i <= range[2]; i = this.round(i + increment,range[0])) {
    result.push(i);
  }

  return result;

};

tools.prototype.runEvery = function(ms, func) {

  var timeout;

  var loopFunc = function() {

    var now = new Date().getTime();
    var next = (now - (now % ms) + ms) - now;

    timeout = setTimeout(func, next);

  };

  loopFunc();

  var interval = setInterval(loopFunc, ms);

  return function() {
    clearInterval(interval);
    clearTimeout(timeout);
  };

};

var utiltools = new tools();

module.exports = utiltools;
