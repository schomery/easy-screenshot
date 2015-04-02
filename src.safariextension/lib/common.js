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

function full () {
  app.screenshot().then(function (canvas) {
    app.download(canvas.toDataURL(), 'screenshot.png');
  });
}

function part () {
  app.content_script.send('capture');
}
app.content_script.receive('capture', function (obj) {
  app.screenshot(obj.left, obj.top, obj.width, obj.height).then(function (canvas) {
    app.download(canvas.toDataURL(), 'screenshot.png');
  });
});

app.context_menu.create(
  'Easy Screenshot', 'icons/16.png', [
    ['Capture Visual Part', 'icons/full.png', full],
    ['Capture a Portion', 'icons/part.png', part]
  ]
);
