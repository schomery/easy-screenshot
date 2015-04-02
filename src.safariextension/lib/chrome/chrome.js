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

app.get = function (url, headers, data) {
  var xhr = new XMLHttpRequest();
  var d = Promise.defer();
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status >= 400) {
        var e = new Error(xhr.statusText);
        e.status = xhr.status;
        d.reject(e);
      }
      else {
        d.resolve(xhr.responseText);
      }
    }
  };
  xhr.open(data ? 'POST' : 'GET', url, true);
  for (var id in headers) {
    xhr.setRequestHeader(id, headers[id]);
  }
  if (data) {
    var arr = [];
    for (var e in data) {
      arr.push(e + '=' + data[e]);
    }
    data = arr.join('&');
  }
  xhr.send(data ? data : '');
  return d.promise;
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

app.screenshot = function (left, top, width, height) {
  var d = Promise.defer();
  left = left  * window.devicePixelRatio;
  top = top  * window.devicePixelRatio;
  width = width  * window.devicePixelRatio;
  height = height  * window.devicePixelRatio;

  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, function (tab) {
    chrome.tabs.captureVisibleTab(tab.windowId, function (dataUrl) {
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
  });
  return d.promise;
};

app.download = function (uri, name) {
  var link = document.createElement('a');
  link.download = name;
  link.href = uri;
  link.click();
};
