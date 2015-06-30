'use strict';

// Load Firefox based resources
var self          = require('sdk/self'),
    data          = self.data,
    sp            = require('sdk/simple-prefs'),
    prefs         = sp.prefs,
    pageMod       = require('sdk/page-mod'),
    tabs          = require('sdk/tabs'),
    timers        = require('sdk/timers'),
    loader        = require('@loader/options'),
    contextMenu   = require('sdk/context-menu'),
    array         = require('sdk/util/array'),
    {Cu}          = require('chrome'),
    {viewFor}     = require('sdk/view/core'),
    windowUtils   =  require('sdk/window/utils'),
    tabsUtils     = require('sdk/tabs/utils'),
    windows       = require('sdk/windows').browserWindows,
    unload        = require('sdk/system/unload');

Cu.import('resource://gre/modules/Promise.jsm');

exports.content_script = (function () {
  var workers = [], content_script_arr = [];
  pageMod.PageMod({
    include: ['http://*', 'https://*', 'file:///*'],
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
      context: contextMenu.PredicateContext(function (context) {
        return context.documentURL.indexOf('http') !== -1 || context.documentURL.indexOf('file') !== -1;
      })
    });
  }
};

exports.version = function () {
  return self.version;
};

exports.timer = timers;

var connect = (function () {
  var d;
  function screenshot (e) {
    if (d) {
      d.resolve(e.data);
    }
  }
  function attach (window) {
    var mm = viewFor(window).messageManager;
    mm.loadFrameScript(data.url('chrome.js'), true);
    mm.addMessageListener('screenshot', screenshot);
  }

  for (let window of windows) {
    attach(window);
  }
  windows.on('open', function (window) {
    attach(window);
  });
  unload.when(function () {
    for (let tab of tabs) {
      var mm = tabsUtils.getBrowserForTab(viewFor(tab)).messageManager;
      mm.removeMessageListener('screenshot', screenshot);
      mm.sendAsyncMessage('detach');
    }
  });
  return {
    screenshot: function (left, top, width, height) {
      d = new Promise.defer();
      var window = windowUtils.getMostRecentBrowserWindow();
      var tab = tabsUtils.getActiveTab(window);
      if (tab) {
        timers.setTimeout(function () {
          tabsUtils.getBrowserForTab(viewFor(tab)).messageManager.sendAsyncMessage('screenshot', {
            left, top, width, height
          });
        }, 500);
      }
      else {
        d.reject();
      }
      return d.promise;
    },
    download: function (uri, name) {
      var window = windowUtils.getMostRecentBrowserWindow();
      var tab = tabsUtils.getActiveTab(window);
      if (tab) {
        timers.setTimeout(function () {
          tabsUtils.getBrowserForTab(viewFor(tab)).messageManager.sendAsyncMessage('download', {
            uri, name
          });
        }, 500);
      }
    }
  };
})();
exports.screenshot = connect.screenshot;
exports.download = connect.download;

sp.on('tineye', function () {
  exports.tab.open('https://addons.mozilla.org/en-US/firefox/addon/capture-reverse-image-search/');
});
