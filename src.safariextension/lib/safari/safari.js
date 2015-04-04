/* globals Q, safari */

'use strict';

var app = {};

app.Promise = Q.promise;
app.Promise.defer = Q.defer;

app.storage = {
  read: function (id) {
    return localStorage[id] || null;
  },
  write: function (id, data) {
    localStorage[id] = data + '';
  }
};

app.button = (function () {
  var callback,
      toolbarItem = safari.extension.toolbarItems[0];
  safari.application.addEventListener('command', function (e) {
    if (e.command === 'toolbarbutton' && callback) {
      app.popup.show();
    }
  }, false);

  return {
    set label (val) {
      toolbarItem.toolTip = val;
    },
    set badge (val) {
      toolbarItem.badge = (val ? val : '') + '';
    }
  };
})();

app.tab = {
  open: function (url, inBackground, inCurrent) {
    if (inCurrent) {
      safari.application.activeBrowserWindow.activeTab.url = url;
    }
    else {
      safari.application.activeBrowserWindow.openTab(inBackground ? 'background' : 'foreground').url = url;
    }
  },
  openOptions: function () {

  }
};

app.version = function () {
  return safari.extension.displayVersion;
};

app.timer = window;

app.content_script = (function () {
  var callbacks = {};
  safari.application.addEventListener('message', function (e) {
    if (callbacks[e.message.id]) {
      callbacks[e.message.id](e.message.data);
    }
  }, false);
  return {
    send: function (id, data, global) {
      if (global) {
        safari.application.browserWindows.forEach(function (browserWindow) {
          browserWindow.tabs.forEach(function (tab) {
            if (tab.page) {
              tab.page.dispatchMessage(id, data);
            }
          });
        });
      }
      else {
        safari.application.activeBrowserWindow.activeTab.page.dispatchMessage(id, data);
      }
    },
    receive: function (id, callback) {
      callbacks[id] = callback;
    }
  };
})();

app.context_menu = (function () {
  var onPage = [];

  safari.application.addEventListener('contextmenu', function (e) {
    onPage.forEach(function (arr, i) {
      e.contextMenu.appendContextMenuItem('contextmenu' + i, arr[0], i);
    });
  }, false);
  safari.application.addEventListener('command', function (e) {
    onPage[+e.command][2]();
  }, false);

  return {
    create: function (label, img, arr) {
      onPage = arr;
    }
  };
})();

app.screenshot = function (left, top, width, height, devicePixelRatio) {
  var d = app.Promise.defer();

  left = left  * devicePixelRatio;
  top = top  * devicePixelRatio;
  width = width  * devicePixelRatio;
  height = height  * devicePixelRatio;

  var tab = safari.application.activeBrowserWindow.activeTab;
  tab.visibleContentsAsDataURL(function (dataUrl) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var img = new Image();
    img.onload = function () {
      canvas.width = width || img.width;
      canvas.height = height || img.height;
      if (width && height) {
        ctx.drawImage(img, left, top, width, height, 0, 0, width, height);
      }
      else {
        ctx.drawImage(img, 0, 0);
      }
      d.resolve(canvas);
    };
    img.src = dataUrl;
  });

  return d.promise;
};

app.download = function (uri) {
  app.tab.open(uri);
};
