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
    return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
};

tools.prototype.floor = function(value, decimals) {
    return Number(Math.floor(value+'e'+decimals)+'e-'+decimals);
};

tools.prototype.rangeToArray = function(range) {

  var result = [];
  var increment = this.floor(1 / Math.pow(10,range[0]), range[0]);

  for(var i = range[1]; i <= range[2]; i = this.round(i + increment,range[0])) {
    result.push(i);
  }

  return result;

}

var utiltools = new tools();

module.exports = utiltools;
