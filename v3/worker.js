/* global ClipboardItem */
'use strict';

const notify = e => chrome.notifications.create({
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  title: chrome.runtime.getManifest().name,
  message: e.message || e
});

function capture(request) {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(null, {format: 'png'}, dataUrl => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        return reject(lastError);
      }

      if (!request) {
        return resolve(dataUrl);
      }

      const left = request.left * request.devicePixelRatio;
      const top = request.top * request.devicePixelRatio;
      const width = request.width * request.devicePixelRatio;
      const height = request.height * request.devicePixelRatio;

      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');

      fetch(dataUrl).then(r => r.blob()).then(async blob => {
        const prefs = await new Promise(resolve => chrome.storage.local.get({
          quality: 0.95
        }, resolve));

        const img = await createImageBitmap(blob);
        if (width && height) {
          ctx.drawImage(img, left, top, width, height, 0, 0, width, height);
        }
        else {
          ctx.drawImage(img, 0, 0);
        }
        canvas.convertToBlob({
          type: 'image/png',
          quality: prefs.quality
        }).then(resolve);
      });
    });
  });
}

function save(blob, tab) {
  chrome.storage.local.get({
    'timestamp': true,
    'saveAs': false,
    'save-disk': true,
    'edit-online': false,
    'save-clipboard': false
  }, prefs => {
    let filename = tab.title;
    if (prefs.timestamp) {
      const time = new Date();
      filename = filename += ' ' + time.toLocaleDateString() + ' ' + time.toLocaleTimeString();
    }

    const reader = new FileReader();
    reader.onload = () => {
      // save to clipboard
      if (prefs['save-clipboard']) {
        chrome.scripting.executeScript({
          target: {tabId: tab.id},
          func: async href => {
            try {
              const blob = await fetch(href).then(r => r.blob());
              await navigator.clipboard.write([new ClipboardItem({
                'image/png': blob
              })]);
            }
            catch (e) {
              console.warn(e);
              alert(e.message);
            }
          },
          args: [reader.result]
        });
      }
      // edit online
      if (prefs['edit-online']) {
        setTimeout(() => chrome.tabs.create({
          url: 'https://webbrowsertools.com/jspaint/pwa/build/index.html#load:' + reader.result
        }), 500);
      }
      // save to disk
      if (prefs['save-disk'] || (prefs['save-clipboard'] === false && prefs['edit-online'] === false)) {
        chrome.downloads.download({
          url: reader.result,
          filename: filename + '.png',
          saveAs: false && prefs.saveAs // saveAs is not supported on v3
        }, () => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            chrome.downloads.download({
              url: reader.result,
              filename: filename.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, '-') + '.png'
            }, () => {
              const lastError = chrome.runtime.lastError;
              if (lastError) {
                chrome.downloads.download({
                  url: reader.result,
                  filename: 'image.png'
                });
              }
            });
          }
        });
      }
    };
    reader.readAsDataURL(blob);
  });
}

async function matrix(tab) {
  const tabId = tab.id;
  const prefs = await new Promise(resolve => chrome.storage.local.get({
    delay: 600,
    offset: 50,
    quality: 0.95
  }, resolve));

  const r = await chrome.scripting.executeScript({
    target: {tabId},
    func: () => {
      return {
        width: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
        height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
        w: document.documentElement.clientWidth,
        h: document.documentElement.clientHeight,
        ratio: window.devicePixelRatio
      };
    }
  });
  const {ratio, width, height, w, h} = r[0].result;
  const canvas = new OffscreenCanvas(width * ratio, height * ratio);
  const ctx = canvas.getContext('2d');

  chrome.action.setBadgeText({tabId, text: 'R'});

  for (let x = 0; x < width - prefs.offset; x += w - prefs.offset) {
    for (let y = 0; y < height - prefs.offset; y += h - prefs.offset) {
      // move to the location
      await chrome.scripting.executeScript({
        target: {tabId},
        func: (x, y) => window.scroll(x, y),
        args: [x, y]
      });
      // wait
      await new Promise(resolve => setTimeout(resolve, prefs.delay));
      // read with delay
      const [{
        result: [i, j]
      }] = await chrome.scripting.executeScript({
        target: {tabId},
        func: () => [
          document.body.scrollLeft || document.documentElement.scrollLeft,
          document.body.scrollTop || document.documentElement.scrollTop
        ]
      });

      // capture
      await chrome.tabs.update(tabId, {
        highlighted: true
      });
      await chrome.windows.update(tab.windowId, {
        focused: true
      });

      const href = await capture();
      // write
      const blob = await fetch(href).then(r => r.blob());
      const img = await createImageBitmap(blob);
      ctx.drawImage(
        img,
        0, 0, img.width, img.height,
        i * ratio, j * ratio, img.width, img.height
      );
    }
  }
  const blob = await canvas.convertToBlob({
    type: 'image/png',
    quality: prefs.quality
  });
  chrome.action.setBadgeText({tabId, text: ''});
  return blob;
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
    capture().then(href => fetch(href).then(r => r.blob())).then(blob => save(blob, tab)).catch(e => {
      console.warn(e);
      notify(e.message || e);
    });
  }
  else if (cmd === 'capture-portion') {
    chrome.scripting.insertCSS({
      target: {tabId: tab.id},
      files: ['data/inject/inject.css']
    }, () => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        return notify(lastError);
      }
      chrome.scripting.executeScript({
        target: {tabId: tab.id},
        files: ['data/inject/inject.js']
      });
    });
  }
  else if (cmd === 'capture-entire') {
    matrix(tab).then(a => save(a, tab)).catch(e => {
      console.warn(e);
      notify(e.message || e);
    });
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  onCommand(info.menuItemId, tab);
});

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'captured') {
    capture(request).then(a => save(a, sender.tab)).catch(e => {
      console.warn(e);
      notify(e.message || e);
    });
  }
  if (request.method === 'popup') {
    onCommand(request.cmd, request.tab);

    response(true);
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
