'use strict';

var app = app || require('./firefox/firefox');
var config = typeof exports === 'undefined' ? {} : exports;

config.options = {
  get timestamp () {
    return app.storage.read('timestamp') === 'false' ? false : true;
  }
};

config.welcome = {
  get version () {
    return app.storage.read('version');
  },
  set version (val) {
    app.storage.write('version', val);
  },
  timeout: 3
};
// Complex get and set
config.get = function (name) {
  return name.split('.').reduce(function (p, c) {
    return p[c];
  }, config);
};
config.set = function (name, value) {
  function set(name, value, scope) {
    name = name.split('.');
    if (name.length > 1) {
      set.call((scope || this)[name.shift()], name.join('.'), value);
    }
    else {
      this[name[0]] = value;
    }
  }
  set(name, value, config);
};
