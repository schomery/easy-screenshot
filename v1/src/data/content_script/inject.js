/* global self, safari*/
'use strict';

var background = {}, manifest = {};
/**** wrapper (start) ****/
if (typeof self !== 'undefined' && self.port) { //Firefox
  background.send = function (id, data) {
    self.port.emit(id, data);
  };
  background.receive = function (id, callback) {
    self.port.on(id, callback);
  };
  manifest.url = self.options.base;
  self.port.on('detach', function () {
    try {
      capture.remove();
      guide.remove();
    }
    catch (e) {}
  });
}
else if (typeof safari !== 'undefined') { // Safari
  background.send = function (id, obj) {
    safari.self.tab.dispatchMessage('message', {
      id: id,
      data: obj
    });
  };
  background.receive = (function () {
    var callbacks = {};
    safari.self.addEventListener('message', function (e) {
      if (callbacks[e.name]) {
        callbacks[e.name](e.message);
      }
    }, false);

    return function (id, callback) {
      callbacks[id] = callback;
    };
  })();
  manifest.url = safari.extension.baseURI;

  document.addEventListener('contextmenu', function () {
    var selectedText = window.getSelection().toString();
    try {
      safari.self.tab.setContextMenuEventUserInfo(event, {
          selectedText: selectedText
      });
    } catch (e) {}
  }, false);
}
else {  // Chrome
  background.send = function (id, data) {
    chrome.extension.sendRequest({method: id, data: data});
  };
  background.receive = function (id, callback) {
    chrome.runtime.onMessage.addListener(function (request) {
      if (request.method === id) {
        callback(request.data);
      }
    });
  };
  manifest.url = chrome.extension.getURL('./');
}
/**** wrapper (end) ****/

var capture = (function () {
  var box, _left, _top, left, top, width, height;

  function update (e) {
    left = (e.clientX > _left ? _left : e.clientX - 1);
    top = (e.clientY > _top ? _top : e.clientY - 1);
    width = Math.abs(e.clientX - _left);
    height = Math.abs(e.clientY - _top);
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.width = width + 'px';
    box.style.height = height + 'px';
  }
  function remove () {
    background.send('capture', {
      left: left + 1,
      top: top + 1,
      width: width - 2,
      height: height - 2,
      devicePixelRatio: window.devicePixelRatio,
      title: document.title
    });
    guide.remove();
    capture.remove();
    monitor.remove();
  }
  function mousedown(e) {
    // prevent content selection on Firefox
    e.stopPropagation();
    e.preventDefault();
    box = document.createElement('div');
    box.setAttribute('class', 'itrisearch-box');

    _left = e.clientX;
    _top = e.clientY;

    document.addEventListener('mousemove', update, false);
    document.addEventListener('mouseup', remove, false);
    document.body.appendChild(box);
  }

  return {
    install: function () {
      document.addEventListener('mousedown', mousedown, false);
    },
    remove: function () {
      document.removeEventListener('mousedown', mousedown, false);
      document.removeEventListener('mousemove', update, false);
      document.removeEventListener('mouseup', remove, false);
      if (box && box.parentNode) {
        box.parentNode.removeChild(box);
      }
    }
  };
})();

var guide = (function () {
  var guide1, guide2, guide3;
  function position (left, top) {
    guide1.style.width = left + 'px';
    guide2.style.height = top + 'px';
  }
  function update (e) {
    position(e.clientX, e.clientY);
  }
  return {
    install: function () {
      guide1 = document.createElement('div');
      guide2 = document.createElement('div');
      guide3 = document.createElement('div');
      guide1.setAttribute('class', 'itrisearch-guide-1');
      guide2.setAttribute('class', 'itrisearch-guide-2');
      guide3.setAttribute('class', 'itrisearch-guide-3');
      document.body.appendChild(guide3);
      document.body.appendChild(guide1);
      document.body.appendChild(guide2);
      document.addEventListener('mousemove', update, false);
    },
    remove: function () {
      document.removeEventListener('mousemove', update, false);
      if (guide1 && guide1.parentNode) {
        guide1.parentNode.removeChild(guide1);
      }
      if (guide2 && guide2.parentNode) {
        guide2.parentNode.removeChild(guide2);
      }
      if (guide3 && guide3.parentNode) {
        guide3.parentNode.removeChild(guide3);
      }
      capture.remove();
    }
  };
})();

var monitor = (function () {
  function keydown (e) {
    if (e.keyCode === 27) {
      guide.remove();
      capture.remove();
      monitor.remove();
    }
  }
  return {
    install: function () {
      window.addEventListener('keydown', keydown, false);
    },
    remove: function () {
      window.removeEventListener('keydown', keydown, false);
    }
  };
})();

background.receive('capture', function () {
  guide.install();
  capture.install();
  monitor.install();
});

background.receive('entire', function () {
  background.send('entire', {
    title: document.title,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    maxWidth: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth, document.body.offsetWidth, document.documentElement.offsetWidth, document.body.clientWidth, document.documentElement.clientWidth),
    maxHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight, document.body.clientHeight, document.documentElement.clientHeight),
  });
});

background.receive('visual', function () {
  background.send('visual', {
    title: document.title,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    maxWidth: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth, document.body.offsetWidth, document.documentElement.offsetWidth, document.body.clientWidth, document.documentElement.clientWidth),
    maxHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight, document.body.clientHeight, document.documentElement.clientHeight),
  });
});
