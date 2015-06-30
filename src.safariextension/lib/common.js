'use strict';

/**** wrapper (start) ****/
var isFirefox = typeof require !== 'undefined';

if (isFirefox) {
  var app = require('./firefox/firefox');
  var config = require('./config');
}
/**** wrapper (end) ****/

// welcome
(function () {
  var version = config.welcome.version;
  if (app.version() !== version) {
    app.timer.setTimeout(function () {
      app.tab.open('http://mybrowseraddon.com/screenshot.html?v=' + app.version() + (version ? '&p=' + version + '&type=upgrade' : '&type=install'));
      config.welcome.version = app.version();
    }, config.welcome.timeout);
  }
})();

function name (title) {
  return title
    .replace(/\+/g, ' ')
    .replace(/[:\?\¿]/g, '')
    .replace(/[\\\/]/g, '-')
    .replace(/[\*]/g, '^')
    .replace(/[\"]/g, "'")
    .replace(/[\<]/g, '[')
    .replace(/[\>]/g, ']')
    .replace(/[|]/g, '-');
}
function visual () {
  app.content_script.send('visual');
}
app.content_script.receive('visual', function (obj) {
  app.screenshot().then(function (dataURL) {
    app.download(dataURL, name(obj.title) + '.png');
  });
});

function entire () {
  app.content_script.send('entire');
}
app.content_script.receive('entire', function (obj) {
  app.screenshot(-obj.scrollX, -obj.scrollY, obj.maxWidth, obj.maxHeight).then(function (dataURL) {
    app.download(dataURL, name(obj.title) + '.png');
  });
});

function part () {
  app.content_script.send('capture');
}
app.content_script.receive('capture', function (obj) {
  app.screenshot(obj.left, obj.top, obj.width, obj.height, obj.devicePixelRatio).then(function (dataURL) {
    app.download(dataURL, name(obj.title) + '.png');
  });
});

(function () {
  var items = [
    ['Capture Visual Part', 'icons/visual.png', visual],
    ['Capture a Portion', 'icons/part.png', part]
  ];
  if (isFirefox) {
    items.unshift(['Capture Entire Screen', 'icons/entire.png', entire]);
  }
  app.context_menu.create('Easy Screenshot', 'icons/16.png', items);
})();

