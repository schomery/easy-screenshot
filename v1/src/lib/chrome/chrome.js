'use strict';

var app = {};
var config = {}; // jshint ignore:line

if (!Promise.defer) {
  Promise.defer = function () {
    let deferred = {};
    let promise = new Promise(function (resolve, reject) {
      deferred.resolve = resolve;
      deferred.reject  = reject;
    });
    deferred.promise = promise;
    return deferred;
  };
}
app.Promise = Promise;

app.manifest = {
  fullScreen: false
};

app.storage = {
  read: function (id) {
    return localStorage[id] || null;
  },
  write: function (id, data) {
    localStorage[id] = data + '';
  }
};

app.inject = {
  send: function (id, data, global) {
    let options = global ? {} : {active: true, currentWindow: true};
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

app.contextMenu = {
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
  let d = Promise.defer();
  left = left  * devicePixelRatio;
  top = top  * devicePixelRatio;
  width = width  * devicePixelRatio;
  height = height  * devicePixelRatio;

  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, function (tab) {
    chrome.tabs.captureVisibleTab(tab.windowId, {format: 'png'}, function (dataUrl) {
      let canvas = document.createElement('canvas');
      let ctx = canvas.getContext('2d');
      let img = new Image();
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

app.download = function (url, filename) {
   //url = url.replace(/data\:[^\;]*/, 'data:application/octet-stream');
  let link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
};
