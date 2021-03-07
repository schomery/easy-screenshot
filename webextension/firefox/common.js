'use strict';

const notify = e => chrome.notifications.create({
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  title: chrome.runtime.getManifest().name,
  message: e.message || e
});

function capture(request) {
  return new Promise(function(resolve, reject) {
    chrome.tabs.captureVisibleTab(null, {format: 'png'}, dataUrl => {
      if (!request) {
        return resolve(dataUrl);
      }

      const left = request.left * request.devicePixelRatio;
      const top = request.top * request.devicePixelRatio;
      const width = request.width * request.devicePixelRatio;
      const height = request.height * request.devicePixelRatio;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
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

function save(url, filename) {
  chrome.storage.local.get({
    timestamp: true,
    saveAs: false
  }, prefs => {
    if (prefs.timestamp) {
      const time = new Date();
      filename = filename += ' ' + time.toLocaleDateString() + ' ' + time.toLocaleTimeString();
    }
    filename = filename
      .replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, '-');
    filename += '.png';

    fetch(url).then(res => res.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({
        url,
        filename,
        saveAs: prefs.saveAs
      }, () => {
        if (chrome.runtime.lastError) {
          chrome.downloads.download({
            url,
            filename: 'image.png'
          });
        }
        setTimeout(() => URL.revokeObjectURL(url), 20000);
      });
    });
  });
}

function matrix(id) {
  return new Promise(function(resolve, reject) {
    chrome.storage.local.get({
      delay: 500,
      offset: 50
    }, prefs => {
      const locations = [];
      const cache = [];
      let devicePixelRatio = 1;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      function two() {
        if (cache.length) {
          const obj = cache.shift();
          const img = new Image();
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

      function one() {
        if (locations.length) {
          const [x, y] = locations.shift();
          chrome.tabs.executeScript(id, {
            'code': `
              window.scroll(${x}, ${y});
              [
                document.body.scrollLeft || document.documentElement.scrollLeft,
                document.body.scrollTop || document.documentElement.scrollTop
              ]
            `
          }, rtn => {
            const [x, y] = rtn[0];
            window.setTimeout(() => {
              capture().then(dataUrl => {
                // save(dataUrl, x + '-' + y + '.png');
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
          [
            document.body.scrollWidth,
            document.body.scrollHeight,
            document.documentElement.clientWidth,
            document.documentElement.clientHeight,
            window.devicePixelRatio
          ]
        `
      }, rtn => {
        const [scrollWidth, scrollHeight, innerWidth, innerHeight] = rtn[0];
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

{
  const once = () => {
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
  };
  if (chrome.runtime && chrome.runtime.onInstalled) {
    chrome.runtime.onInstalled.addListener(once);
  }
  else {
    once();
  }
}

function onCommand(cmd, tab) {
  if (cmd === 'capture-visual') {
    capture().then(a => save(a, tab.title)).catch(e => notify(e.message || e));
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
    matrix(tab.id).then(a => save(a, tab.title)).catch(e => notify(e.message || e));
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  onCommand(info.menuItemId, tab);
});

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.method === 'captured') {
    capture(request).then(a => save(a, sender.tab.title)).catch(e => notify(e.message || e));
  }
  if (request.method === 'popup') {
    onCommand(request.cmd, request.tab);
  }
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
