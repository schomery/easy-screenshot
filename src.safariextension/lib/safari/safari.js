var app = {}

app.Promise = Q.promise;
app.Promise.defer = Q.defer;

app.storage = {
  read: function (id) {
    return localStorage[id] || null;
  },
  write: function (id, data) {
    localStorage[id] = data + "";
  }
}

app.get = function (url, headers, data) {
  var xhr = new XMLHttpRequest();
  var d = new app.Promise.defer();
  xhr.onreadystatechange = function() {
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
  xhr.open(data ? "POST" : "GET", url, true);
  for (var id in headers) {
    xhr.setRequestHeader(id, headers[id]);
  }
  if (data) {
    var arr = [];
    for(e in data) {
      arr.push(e + "=" + data[e]);
    }
    data = arr.join("&");
  }
  xhr.send(data ? data : "");
  return deferred.promise;
}

app.button = (function () {
  var callback,
      toolbarItem = safari.extension.toolbarItems[0];
  safari.application.addEventListener("command", function (e) {
    if (e.command === "toolbarbutton" && callback) {
      app.popup.show();
    }
  }, false);

  return {
    set label (val) {
      toolbarItem.toolTip = val;
    },
    set badge (val) {
      toolbarItem.badge = (val ? val : "") + "";
    }
  }
})();

app.popup = (function () {
  var callbacks = {},
      toolbarItem = safari.extension.toolbarItems[0];
      popup = safari.extension.createPopover("popover", safari.extension.baseURI + "data/popup/index.html", 100, 100);

  safari.application.addEventListener("popover", function (e) {
    popup.width = config.popup.width;
    popup.height = config.popup.height;
  }, true);

  toolbarItem.popover = popup;
  return {
    show: function () {
      toolbarItem.showPopover();
    },
    hide: function () {
      popup.hide();
    },
    send: function (id, data) {
      popup.contentWindow.background.dispatchMessage(id, data);
    },
    receive: function (id, callback) {
      callbacks[id] = callback;
    },
    dispatchMessage: function (id, data) {
      if (callbacks[id]) {
        callbacks[id](data);
      }
    }
  }
})();

app.tab = {
  open: function (url, inBackground, inCurrent) {
    if (inCurrent) {
      safari.application.activeBrowserWindow.activeTab.url = url;
    }
    else {
      safari.application.activeBrowserWindow.openTab(inBackground ? "background" : "foreground").url = url;
    }
  },
  openOptions: function () {

  },
  list: function () {
    var wins = safari.application.browserWindows;
    var tabs = wins.map(function (win) {
      return win.tabs;
    });
    tabs = tabs.reduce(function (p, c) {
      return p.concat(c);
    }, []);
    return new app.Promise(function (a) {a(tabs)});
  }
}

app.notification = function (title, text) {
  var notification = webkitNotifications.createNotification(
    safari.extension.baseURI + 'data/icon48.png',  title,  text
  );
  notification.show();
  window.setTimeout(function () {
    notification.cancel();
  }, 5000);
}

app.notification = function (title, text) {
  var notification = webkitNotifications.createNotification(
    safari.extension.baseURI + 'data/icon48.png',  title,  text
  );
  notification.show();
  window.setTimeout(function () {
    notification.cancel();
  }, 5000);
}

app.play = (function () {
  var canPlay = false;
  try {
    var audio = new Audio();
    canPlay = audio.canPlayType("audio/mpeg");
  } catch (e) {}
  if (!canPlay) {
    audio = document.createElement("iframe");
    document.body.appendChild(audio);
  }
  return function (url) {
    if (canPlay) {
      audio.setAttribute("src", url);
      audio.play();
    }
    else {
      audio.removeAttribute('src');
      audio.setAttribute('src', url);
    }
  }
})();

app.version = function () {
  return safari.extension.displayVersion;
}

app.timer = window;

app.content_script = (function () {
  var callbacks = {};
  safari.application.addEventListener("message", function (e) {
    if (callbacks[e.message.id]) {
      callbacks[e.message.id](e.message.data);
    }
  }, false);
  return {
    send: function (id, data, global) {
      if (global) {
        safari.application.browserWindows.forEach(function (browserWindow) {
          browserWindow.tabs.forEach(function (tab) {
            if (tab.page) tab.page.dispatchMessage(id, data);
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
  }
})();

app.context_menu = (function () {
  var onSelection = [];
  var onPage = [];

  safari.application.addEventListener("contextmenu", function (e) {
    var selected = e.userInfo && "selectedText" in e.userInfo && e.userInfo.selectedText;

    onPage.forEach(function (arr, i) {
      e.contextMenu.appendContextMenuItem("igtranslator.onPage:" + i, arr[0]);
    });
    if (selected) {
      onSelection.forEach(function (arr, i) {
        e.contextMenu.appendContextMenuItem("igtranslator.onSelection:" + i, arr[0]);
      });
    }
  }, false);
  safari.application.addEventListener("command", function (e) {
    var cmd = e.command;
    if (cmd.indexOf("igtranslator.onPage:") != -1) {
      var i = parseInt(cmd.substr(20));
      onPage[i][1]();
    }
    if (cmd.indexOf("igtranslator.onSelection:") != -1) {
      var i = parseInt(cmd.substr(25));
      onSelection[i][1]();
    }
  }, false);

  return {
    create: function (title, type, callback) {
      if (type == "page") {
        onPage.push([title, callback]);
      }
      if (type == "selection") {
        onSelection.push([title, callback]);
      }
    }
  }
})();

app.options = (function () {
  var callbacks = {};
  safari.application.addEventListener("message", function (e) {
    if (callbacks[e.message.id]) {
      callbacks[e.message.id](e.message.data);
    }
  }, false);
  return {
    send: function (id, data) {
      safari.application.browserWindows.forEach(function (browserWindow) {
        browserWindow.tabs.forEach(function (tab) {
          if (tab.page && tab.url.indexOf("options/index.html") !== -1) {
            tab.page.dispatchMessage(id, data);
          }
        });
      });
    },
    receive: function (id, callback) {
      callbacks[id] = callback;
    }
  }
})();
