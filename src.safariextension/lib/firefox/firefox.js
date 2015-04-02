'use strict';

// Load Firefox based resources
var self          = require('sdk/self'),
    data          = self.data,
    sp            = require('sdk/simple-prefs'),
    Request       = require('sdk/request').Request,
    prefs         = sp.prefs,
    pageMod       = require('sdk/page-mod'),
    tabs          = require('sdk/tabs'),
    timers        = require('sdk/timers'),
    loader        = require('@loader/options'),
    contextMenu   = require('sdk/context-menu'),
    array         = require('sdk/util/array'),
    {Cu}          = require('chrome'),
    windowUtils   =  require('sdk/window/utils'),
    tabsUtils     = require('sdk/tabs/utils');

Cu.import('resource://gre/modules/Promise.jsm');


exports.content_script = (function () {
  var workers = [], content_script_arr = [];
  pageMod.PageMod({
    include: ['*'],
    contentScriptFile: data.url('./content_script/inject.js'),
    contentScriptWhen: 'start',
    contentStyleFile : data.url('./content_script/inject.css'),
    contentScriptOptions: {
      base: loader.prefixURI + loader.name + '/'
    },
    attachTo: ['top', 'existing'],
    onAttach: function (worker) {
      array.add(workers, worker);
      worker.on('pageshow', function () { array.add(workers, this); });
      worker.on('pagehide', function () { array.remove(workers, this); });
      worker.on('detach', function () { array.remove(workers, this); });
      content_script_arr.forEach(function (arr) {
        worker.port.on(arr[0], arr[1]);
      });
    }
  });

  return {
    send: function (id, data, global) {
      workers.forEach(function (worker) {
        if (!global && worker.tab !== tabs.activeTab) {
          return;
        }
        if (!worker) {
          return;
        }
        worker.port.emit(id, data);
      });
    },
    receive: function (id, callback) {
      content_script_arr.push([id, callback]);
      workers.forEach(function (worker) {
        worker.port.on(id, callback);
      });
    }
  };
})();






exports.storage = {
  read: function (id) {
    return (prefs[id] || prefs[id] + '' === 'false') ? (prefs[id] + '') : null;
  },
  write: function (id, data) {
    data = data + '';
    if (data === 'true' || data === 'false') {
      prefs[id] = data === 'true' ? true : false;
    }
    else if (parseInt(data) + '' === data) {
      prefs[id] = parseInt(data);
    }
    else {
      prefs[id] = data + '';
    }
  }
};

exports.tab = {
  open: function (url, inBackground, inCurrent) {
    if (inCurrent) {
      tabs.activeTab.url = url;
    }
    else {
      tabs.open({
        url: url,
        inBackground: typeof inBackground === 'undefined' ? false : inBackground
      });
    }
  }
};

exports.context_menu = {
  create: function (label, img, arr) {
    function addOne ([title, img, callback]) {
      return contextMenu.Item({
        label: title,
        image: data.url(img),
        contentScript: 'self.on("click", function () {self.postMessage();});',
        onMessage: function () {
          callback();
        }
      });
    }
    contextMenu.Menu({
      label: label,
      image: data.url(img),
      items: arr.map(addOne),
      context: contextMenu.PredicateContext(() => true),
    });
  }
};

exports.version = function () {
  return self.version;
};

exports.timer = timers;

exports.screenshot = function (left, top, width, height) {
  var window = windowUtils.getMostRecentBrowserWindow();
  var tab = tabsUtils.getActiveTab(window);
  var thumbnail = window.document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
  window = tab.linkedBrowser.contentWindow;
  left = left || 0;
  top = top || 0;
  width = width || window.innerWidth;
  height = height || window.innerHeight;
  thumbnail.width = width;
  thumbnail.height = height;
  var ctx = thumbnail.getContext('2d');
  ctx.drawWindow(window, window.scrollX + left, window.scrollY + top, width, height, 'rgb(255,255,255)');

  return Promise.resolve(thumbnail);
};

exports.download = function (uri, name) {
  var window = windowUtils.getMostRecentBrowserWindow();
  var tab = tabsUtils.getActiveTab(window);
  var document = tab.linkedBrowser.contentWindow.document;
  var link = document.createElement('a');
  link.setAttribute('style', 'display: none');
  link.download = name;
  link.href = uri;
  document.body.appendChild(link);
  link.click();
};
