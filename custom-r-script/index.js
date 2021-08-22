var _ = require("underscore"),
  child_process = require("child_process");

function init(path) {
  var obj = new R(path);
  _.bindAll(obj, "data", "call", "callSync");
  return obj;
}

function R(path) {
  this.d = {};
  this.path = path;
  this.options = {
    env: _.extend({ DIRNAME: __dirname }, process.env),
    encoding: "utf8"
  };
  this.idCounter = 0;
  this.args = ["--vanilla", __dirname + "/R/launch.R"];
}

R.prototype.data = function() {
  for (var i = 0; i < arguments.length; i++) {
    this.d[++this.idCounter] = arguments[i];
  }
  return this;
};

function getReturnData(d) {
  try {
    return JSON.parse(d);
  } catch (err) {
    return d;
  }
}

R.prototype.call = function(_opts, _callback) {
  console.log("calling R script");
  var callback = _callback || _opts;
  var opts = _.isFunction(_opts) ? {} : _opts;
  this.options.env.input = JSON.stringify([this.d, this.path, opts]);
  var child = child_process.spawn("Rscript", this.args, this.options);
  var errData = "";
  var outData = "";

  child.stderr.on("data", function(d) {
    errData += d;
  });

  child.stdout.on("data", function(d) {
    outData += d;
  });

  child.on("close", code => {
    callback(null, getReturnData(outData));
    // if (errData) {
    //   console.log("error");
    //   console.log(errData);
    //   callback(getReturnData(errData));
    // } else {
    //   console.log("success");
    //   callback(null, getReturnData(outData));
    // }
  });
};

R.prototype.callSync = function(_opts) {
  var opts = _opts || {};
  this.options.env.input = JSON.stringify([this.d, this.path, opts]);
  var child = child_process.spawnSync("Rscript", this.args, this.options);
  if (child.stderr) throw child.stderr;
  return JSON.parse(child.stdout);
};

module.exports = init;
