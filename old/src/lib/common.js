'use strict';

var app = app || require('./firefox/firefox');
var config = config || require('./config');

// welcome
(function () {
  var version = config.welcome.version;
  if (app.version() !== version) {
    app.timer.setTimeout(function () {
      app.tab.open(
        'http://mybrowseraddon.com/screenshot.html?v=' + app.version() + (version ? '&p=' + version + '&type=upgrade' : '&type=install')
      );
      config.welcome.version = app.version();
    }, config.welcome.timeout);
  }
})();

function name (title) {
  if (config.options.timestamp) {
    title = title += ' ' + ((new Date()).toLocaleString()).replace(/\:/g, '-');
  }
  return title
    .replace(/\+/g, ' ')
    .replace(/[:\?\¿]/g, '')
    .replace(/[\\\/]/g, '-')
    .replace(/[\*]/g, '^')
    .replace(/[\"]/g, '\'')
    .replace(/[<]/g, '[')
    .replace(/[\>]/g, ']')
    .replace(/[|]/g, '-');
}
function visual () {
  app.inject.send('visual');
}
app.inject.receive('visual', function (obj) {
  app.screenshot().then(function (dataURL) {
    app.download(dataURL, name(obj.title) + '.png');
  });
});

function entire () {
  app.inject.send('entire');
}
app.inject.receive('entire', function (obj) {
  app.screenshot(-obj.scrollX, -obj.scrollY, obj.maxWidth, obj.maxHeight).then(function (dataURL) {
    app.download(dataURL, name(obj.title) + '.png');
  });
});

function part () {
  app.inject.send('capture');
}
app.inject.receive('capture', function (obj) {
  app.screenshot(obj.left, obj.top, obj.width, obj.height, obj.devicePixelRatio).then(function (dataURL) {
    app.download(dataURL, name(obj.title) + '.png');
  });
});

(function () {
  var items = [
    ['Capture Visual Part', 'icons/visual.png', visual],
    ['Capture a Portion', 'icons/part.png', part]
  ];
  if (app.manifest.fullScreen) {
    items.unshift(['Capture Entire Screen', 'icons/entire.png', entire]);
  }
  app.contextMenu.create('Easy Screenshot', 'icons/32.png', items);
})();
