'use strict';

var self = require('sdk/self');
var data = self.data;
var tabs = require('sdk/tabs');
var tabsUtils = require('sdk/tabs/utils');
var unload = require('sdk/system/unload');
var {viewFor} = require('sdk/view/core');
var callback;

function getMM (tab) {
  return tabsUtils.getBrowserForTab(viewFor(tab)).messageManager;
}

function connect (e) {
  if (callback) {
    callback(e.data);
  }
}
/* attach */
exports.init = function (path) {
  path = data.url(path) + '?' + Math.random();
  function attach (tab) {
    var mm = getMM(tab);
    mm.loadFrameScript(path, true);
    mm.addMessageListener(self.name + '-connect', connect);
  }
  tabs.on('open', attach);
  for (let tab of tabs) {
    attach(tab);
  }
};

/* detach */
unload.when(function () {
  for (let tab of tabs) {
    var mm = getMM(tab);
    mm.removeMessageListener(self.name + '-connect', connect);
    mm.sendAsyncMessage(self.name + '-detach');
  }
});

exports.connect = function (c) {
  callback = c;
};
exports.emit = function (name, obj) {
  var tab = tabs.activeTab;
  if (tab) {
    getMM(tab).sendAsyncMessage(self.name + '-' + name, obj);
  }
};
