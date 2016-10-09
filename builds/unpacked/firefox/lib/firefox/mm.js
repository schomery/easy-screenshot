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
  let tab = tabs.activeTab;
  if (!tab.isInstalled) {
    let path = data.url('./firefox/inject.js') + '?' + Math.random();
    var mm = getMM(tab);
    mm.loadFrameScript(path, true);
    mm.addMessageListener(self.name + '-connect', connect);
    tab.isInstalled = true;
  }
  if (tab) {
    getMM(tab).sendAsyncMessage(self.name + '-' + name, obj);
  }
};
