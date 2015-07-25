/* globals content, addMessageListener, removeMessageListener, sendAsyncMessage */
'use strict';

(function (observers) {
  var active = true;
  var id = 'iescreenshot';

  function connect (obj) {
    sendAsyncMessage(id + '-connect', obj);
  }

  observers.screenshot = function (e) {
    var thumbnail = content.document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
    var left = e.data.left || 0;
    var top = e.data.top || 0;
    var width = e.data.width || content.innerWidth;
    var height = e.data.height || content.innerHeight;
    thumbnail.width = width;
    thumbnail.height = height;
    var ctx = thumbnail.getContext('2d');
    ctx.drawWindow(content, content.scrollX + left, content.scrollY + top, width, height, '#fff');
    connect(thumbnail.toDataURL());
  };
  observers.download = function (e) {
    var link = content.document.createElement('a');
    link.setAttribute('style', 'display: none');
    link.download = e.data.name;
    link.href = e.data.uri;
    content.document.body.appendChild(link);
    link.click();
  };

  function detach () {
    for (var name in observers) {
      removeMessageListener(id + '-' + name, observers[name]);
    }
    removeMessageListener(id + '-detach', detach);
    active = false;
  }
  if (active) {
    for (var name in observers) {
      addMessageListener(id + '-' + name, observers[name]);
    }
    addMessageListener(id + '-detach', detach);
  }
})({});
