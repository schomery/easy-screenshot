'use strict';

function capture (request) {
  return new Promise(function (resolve, reject) {
    chrome.tabs.captureVisibleTab(null, {format: 'png'}, (dataUrl) => {
      if (!request) {
        return resolve(dataUrl);
      }

      let left = request.left * request.devicePixelRatio;
      let top = request.top * request.devicePixelRatio;
      let width = request.width * request.devicePixelRatio;
      let height = request.height * request.devicePixelRatio;

      let canvas = document.createElement('canvas');
      let ctx = canvas.getContext('2d');
      let img = new Image();
      img.onload = () => {
        canvas.width = width || img.width;
        canvas.height = height || img.height;
        if (width && height) {
          ctx.drawImage(img, left, top, width, height, 0, 0, width, height);
        }
        else {
          ctx.drawImage(img, 0, 0);
        }
        resolve(canvas.toDataURL());
      };
      img.onerror = e => reject(e);
      img.src = dataUrl;
    });
  });
}

function save (url, filename) {
  chrome.storage.local.get({
    timestamp: true,
    saveAs: false
  }, prefs => {
    if (prefs.timestamp) {
      filename = filename += ' ' + ((new Date()).toLocaleString()).replace(/\:/g, '-');
    }
    filename = filename
      .replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '');
    filename += '.png';

    fetch(url)
    .then(res => res.blob())
    .then(blob => {
      let url = URL.createObjectURL(blob);
      chrome.downloads.download({
        url,
        filename,
        saveAs: prefs.saveAs
      }, () => {
        if (chrome.runtime.lastError) {
          let a = document.createElement('a');
          a.href = url;
          a.setAttribute('download', filename);
          a.dispatchEvent(new MouseEvent('click'));
        }
      });
    });

  });
}

function matrix (id) {
  return new Promise(function (resolve, reject) {
    chrome.storage.local.get({
      delay: 500,
      offset: 50
    }, prefs => {
      let locations = [];
      let cache = [];
      let devicePixelRatio = 1;
      let canvas = document.createElement('canvas');
      let ctx = canvas.getContext('2d');

      function two () {
        if (cache.length) {
          let obj = cache.shift();
          let img = new Image();
          img.onload = () => {
            ctx.drawImage(
              img, 0, 0,
              img.width * devicePixelRatio,
              img.height * devicePixelRatio,
              obj.x * devicePixelRatio,
              obj.y * devicePixelRatio,
              img.width * devicePixelRatio,
              img.height * devicePixelRatio
            );
            two();
          };
          img.onerror = e => reject(e);
          img.src = obj.dataUrl;
        }
        else {
          resolve(canvas.toDataURL());
        }
      }

      function one () {
        if (locations.length) {
          let [x, y] = locations.shift();
          chrome.tabs.executeScript(id, {
            'code': `
              window.scroll(${x}, ${y});
              [
                document.body.scrollLeft || document.documentElement.scrollLeft,
                document.body.scrollTop || document.documentElement.scrollTop
              ]
            `
          }, rtn => {
            let [x, y] = rtn[0];
            window.setTimeout(() => {
              capture().then(dataUrl => {
                //save(dataUrl, x + '-' + y + '.png');
                cache.push({x, y, dataUrl});
                one();
              });
            }, prefs.delay);
          });
        }
        else {
          two();
        }
      }

      chrome.tabs.executeScript(id, {
        'code': `
          [document.body.scrollWidth, document.body.scrollHeight, document.documentElement.clientWidth, document.documentElement.clientHeight, window.devicePixelRatio]
        `
      }, rtn => {
        let [scrollWidth, scrollHeight, innerWidth, innerHeight] = rtn[0];
        devicePixelRatio = rtn[0][4];
        canvas.width = scrollWidth * devicePixelRatio;
        canvas.height = scrollHeight * devicePixelRatio;
        for (let x = 0; x < scrollWidth - prefs.offset; x += innerWidth - prefs.offset) {
          for (let y = 0; y < scrollHeight - prefs.offset; y += innerHeight - prefs.offset) {
            locations.push([x, y]);
          }
        }
        one();
      });
    });
  });
}

(function (callback) {
  if (chrome.runtime && chrome.runtime.onInstalled) {
    chrome.runtime.onInstalled.addListener(callback);
  }
  else {
    callback();
  }
})(function () {
  chrome.contextMenus.create({
    'id': 'capture-visual',
    'title': 'Capture Visual Part',
    'contexts': ['page', 'selection', 'link']
  });
  chrome.contextMenus.create({
    'id': 'capture-portion',
    'title': 'Capture a Portion',
    'contexts': ['page', 'selection', 'link']
  });
  chrome.contextMenus.create({
    'id': 'capture-entire',
    'title': 'Capture Entire Screen',
    'contexts': ['page', 'selection', 'link']
  });
});

function onCommand (cmd, tab) {
  if (cmd === 'capture-visual') {
    capture().then(a => save(a, tab.title)).catch(e => window.alert(e.message || e));
  }
  else if (cmd === 'capture-portion') {
    chrome.tabs.insertCSS(tab.id, {
      file: 'data/inject/inject.css'
    }, () => {
      chrome.tabs.executeScript(tab.id, {
        file: 'data/inject/inject.js'
      });
    });
  }
  else if (cmd === 'capture-entire') {
    matrix(tab.id).then(a => save(a, tab.title)).catch(e => window.alert(e.message || e));
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  onCommand(info.menuItemId, tab);
});

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.method === 'captured') {
    capture(request).then(a => save(a, sender.tab.title)).catch(e => window.alert(e.message || e));
  }
  if (request.method === 'popup') {
    onCommand(request.cmd, request.tab);
  }
});

//
chrome.storage.local.get('version', prefs => {
  let version = chrome.runtime.getManifest().version;
  let isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;
  if (isFirefox ? !prefs.version : prefs.version !== version) {
    chrome.storage.local.set({version}, () => {
      chrome.tabs.create({
        url: 'http://mybrowseraddon.com/screenshot.html?version=' + version +
          '&type=' + (prefs.version ? ('upgrade&p=' + prefs.version) : 'install')
      });
    });
  }
});
(function () {
  let {version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL('http://mybrowseraddon.com/screenshot.html?type=uninstall' + '&v=' + version);
})();
