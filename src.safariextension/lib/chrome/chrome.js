'use strict';

var app = {};

app.Promise = Promise;

app.storage = {
  read: function (id) {
    return localStorage[id] || null;
  },
  write: function (id, data) {
    localStorage[id] = data + '';
  }
};

app.content_script = {
  send: function (id, data, global) {
    var options = global ? {} : {active: true, currentWindow: true};
    chrome.tabs.query(options, function (tabs) {
      tabs.forEach(function (tab) {
        chrome.tabs.sendMessage(tab.id, {method: id, data: data}, function () {});
      });
    });
  },
  receive: function (id, callback) {
    chrome.extension.onRequest.addListener(function (request, sender) {
      if (request.method === id && sender.tab) {
        callback(request.data);
      }
    });
  }
};

app.tab = {
  open: function (url, inBackground, inCurrent) {
    if (inCurrent) {
      chrome.tabs.update(null, {url: url});
    }
    else {
      chrome.tabs.create({
        url: url,
        active: typeof inBackground === 'undefined' ? true : !inBackground
      });
    }
  }
};

app.context_menu = {
  create: function (label, img, arr) {
    arr.forEach(function (a) {
      chrome.contextMenus.create({
        'title': a[0],
        'contexts': ['page', 'selection', 'link'],
        'onclick': function () {
          a[2]();
        }
      });
    });
  }
};

app.version = function () {
  return chrome[chrome.runtime && chrome.runtime.getManifest ? 'runtime' : 'extension'].getManifest().version;
};

app.timer = window;

app.screenshot = function (left, top, width, height, devicePixelRatio) {
  var d = Promise.defer();
  left = left  * devicePixelRatio;
  top = top  * devicePixelRatio;
  width = width  * devicePixelRatio;
  height = height  * devicePixelRatio;

  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, function (tab) {
    chrome.tabs.captureVisibleTab(tab.windowId, {format: 'png'}, function (dataUrl) {
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
        d.resolve(canvas.toDataURL());
      };
      img.src = dataUrl;
    });
  });
  return d.promise;
};

app.download = function (uri, name) {
  var link = document.createElement('a');
  link.download = name;
  link.href = uri;
  link.click();
};
