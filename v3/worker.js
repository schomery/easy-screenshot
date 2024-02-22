/* global ceds */
'use strict';

self.importScripts('ceds.js');

chrome.runtime.onConnect.addListener(p => {
  p.onDisconnect.addListener(() => {
    console.info('port is closed', p.name);
  });
});

const notify = e => chrome.notifications.create({
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  title: chrome.runtime.getManifest().name,
  message: e.message || e
});

const sanitizeFilename = filename => {
  // Common replacements
  filename = filename.replace(/[\\/:"*?<>|]/g, '_'); // Replace disallowed characters with underscores
  filename = filename.replace(/^\.+/g, ''); // Remove leading periods

  // OS-specific restrictions
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('win')) {
    // Windows specific restrictions
    filename = filename.replace(/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i, ''); // Remove reserved file names
    filename = filename.replace(/[\x00-\x1F\x7F-\x9F]/g, '_'); // Remove control characters
    filename = filename.substring(0, 255); // Windows max filename length is 255 characters
  }
  else if (platform.includes('mac') || platform.includes('linux')) {
    // macOS and Linux specific restrictions
    filename = filename.trim(); // Trim leading/trailing whitespace
    filename = filename.replace(/^\./g, ''); // Remove leading periods
    filename = filename.substring(0, 255); // macOS and Linux max filename length is 255 characters
  }

  return filename;
};

function capture(request) {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(null, {format: 'png'}, dataUrl => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        return reject(lastError);
      }

      if (!request) {
        return fetch(dataUrl).then(r => r.blob()).then(resolve, reject);
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
        }).then(resolve, reject);
      }).catch(reject);
    });
  });
}

function save(blob, tab) {
  chrome.storage.local.get({
    'saveAs': false,
    'save-disk': true,
    'edit-online': false,
    'save-clipboard': false,
    'mask': '[date] - [time] - [title]'
  }, prefs => {
    // prefs.saveAs = false; // saveAs is not supported on v3

    const filename = prefs['mask']
      .replace('[title]', tab.title)
      .replace('[date]', new Intl.DateTimeFormat('en-CA').format())
      .replace('[time]', new Intl.DateTimeFormat('en-CA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format());

    const next = du => {
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
          args: [du],
          injectImmediately: true
        });
      }
      // edit online
      if (prefs['edit-online']) {
        setTimeout(() => chrome.tabs.create({
          url: 'https://webbrowsertools.com/jspaint/pwa/build/index.html#load:' + du
        }), 500);
      }
      // save to disk
      if (prefs['save-disk'] || (prefs['save-clipboard'] === false && prefs['edit-online'] === false)) {
        chrome.downloads.download({
          url: du,
          filename: filename + '.png',
          saveAs: prefs.saveAs
        }, () => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            chrome.downloads.download({
              url: du,
              filename: sanitizeFilename(filename) + '.png',
              saveAs: prefs.saveAs
            }, () => {
              const lastError = chrome.runtime.lastError;
              if (lastError) {
                chrome.downloads.download({
                  url: du,
                  filename: 'image.png',
                  saveAs: prefs.saveAs
                });
              }
            });
          }
        });
      }
    };
    if (typeof blob === 'string') {
      next(blob);
    }
    else {
      const reader = new FileReader();
      reader.onload = () => next(reader.result);
      reader.readAsDataURL(blob);
    }
  });
}

async function matrix(tab) {
  const tabId = tab.id;
  const prefs = await new Promise(resolve => chrome.storage.local.get({
    delay: 600,
    offset: 50,
    quality: 0.95
  }, resolve));
  prefs.delay = Math.max(prefs.delay, 1000 / chrome.tabs.MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND || 2);

  const r = await chrome.scripting.executeScript({
    target: {tabId},
    func: () => {
      self.port = chrome.runtime.connect({
        name: 'matrix'
      });

      return {
        width: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
        height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
        w: document.documentElement.clientWidth,
        h: document.documentElement.clientHeight,
        ratio: window.devicePixelRatio
      };
    },
    injectImmediately: true
  });
  const {ratio, width, height, w, h} = r[0].result;
  const canvas = new OffscreenCanvas(width * ratio, height * ratio);
  const ctx = canvas.getContext('2d');

  chrome.action.setBadgeText({tabId, text: 'R'});

  const mx = Math.ceil(
    (width - prefs.offset) / (w - prefs.offset)) * Math.ceil((height - prefs.offset) / (h - prefs.offset)
  );
  let p = 0;

  for (let x = 0; x < width - prefs.offset; x += w - prefs.offset) {
    for (let y = 0; y < height - prefs.offset; y += h - prefs.offset) {
      p += 1;
      chrome.action.setBadgeText({tabId, text: (p / mx * 100).toFixed(0) + '%'});

      // move to the location
      await chrome.scripting.executeScript({
        target: {tabId},
        func: (x, y) => window.scrollTo({
          left: x,
          top: y,
          behavior: 'instant'
        }),
        args: [x, y],
        injectImmediately: true
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
        ],
        injectImmediately: true
      });

      // capture
      await chrome.tabs.update(tabId, {
        highlighted: true
      });
      await chrome.windows.update(tab.windowId, {
        focused: true
      });

      const blob = await capture();
      // write
      const img = await createImageBitmap(blob);
      ctx.drawImage(
        img,
        0, 0, img.width, img.height,
        i * ratio, j * ratio, img.width, img.height
      );
    }
  }
  chrome.action.setBadgeText({tabId, text: '...'});
  const blob = await canvas.convertToBlob({
    type: 'image/png',
    quality: prefs.quality
  });
  chrome.action.setBadgeText({tabId, text: ''});
  chrome.scripting.executeScript({
    target: {tabId},
    func: () => {
      try {
        self.port.disconnect();
      }
      catch (e) {}
    }
  });
  return blob;
}

{
  const once = () => {
    chrome.contextMenus.create({
      'id': 'capture-portion',
      'title': 'Capture a Portion',
      'contexts': ['page', 'selection', 'link']
    });
    chrome.contextMenus.create({
      'id': 'capture-visual',
      'title': 'Capture Visual Part',
      'contexts': ['page', 'selection', 'link']
    });
    chrome.contextMenus.create({
      'id': 'capture-entire',
      'title': 'Capture Entire Screen (steps)',
      'contexts': ['page', 'selection', 'link']
    });
    chrome.contextMenus.create({
      'id': 'capture-entire-debugger',
      'title': 'Capture Entire Screen (debugger)',
      'contexts': ['page', 'selection', 'link']
    });
    chrome.contextMenus.create({
      'id': 'capture-entire-debugger-steps',
      'title': 'Capture Entire Screen (debugger + steps)',
      'contexts': ['page', 'selection', 'link']
    });
    chrome.contextMenus.create({
      'id': 'capture-element',
      'title': 'Capture Selected Element',
      'contexts': ['selection'],
      'visible': false
    });
  };
  if (chrome.runtime && chrome.runtime.onInstalled) {
    chrome.runtime.onInstalled.addListener(once);
  }
  else {
    once();
  }
}

function capturewithdebugger(options, tab) {
  const target = {
    tabId: tab.id
  };

  return new Promise((resolve, reject) => chrome.debugger.attach(target, '1.3', () => {
    const lastError = chrome.runtime.lastError;

    if (lastError) {
      reject(lastError);
    }
    else {
      chrome.debugger.sendCommand(target, 'Page.captureScreenshot', {
        format: 'png',
        ...options
      }, result => {
        const lastError = chrome.runtime.lastError;

        if (lastError) {
          chrome.debugger.detach(target);
          reject(lastError);
        }
        else if (!result) {
          chrome.debugger.detach(target);
          reject(Error('Failed to capture screenshot'));
        }
        else {
          chrome.debugger.detach(target);

          save('data:image/png;base64,' + result.data, tab);
          resolve();
        }
      });
    }
  }));
}

function onCommand(cmd, tab, info) {
  if (cmd === 'capture-visual') {
    capture().then(blob => save(blob, tab)).catch(e => {
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
        files: ['data/inject/inject.js'],
        injectImmediately: true
      });
    });
  }
  else if (cmd === 'capture-entire') {
    matrix(tab).then(a => save(a, tab)).catch(e => {
      console.warn(e);
      notify(e.message || e);
    });
  }
  else if (cmd === 'capture-entire-debugger') {
    capturewithdebugger({
      captureBeyondViewport: true
    }, tab).catch(e => {
      console.error(e);
      notify(e.message);
    });
  }
  // alt method
  else if (cmd === 'capture-entire-debugger-steps') {
    ceds(tab).then(du => save(du, tab)).catch(e => {
      console.error(e);
      notify(e.message);
    });
  }
  else if (cmd === 'capture-element') {
    if (info.frameId !== 0) {
      return notify('Currently this function only works on top frame document');
    }

    chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
        frameIds: [info.frameId]
      },
      func: () => {
        const range = getSelection().getRangeAt(0);
        const clientRect = range.getBoundingClientRect();
        range.collapse();

        return {
          x: document.documentElement.scrollLeft + clientRect.x,
          y: document.documentElement.scrollTop + clientRect.y,
          width: clientRect.width,
          height: clientRect.height
        };
      },
      injectImmediately: true
    }).then(r => capturewithdebugger({
      clip: {
        ...r[0].result,
        scale: 1
      },
      captureBeyondViewport: true
    }, tab)).catch(e => {
      console.error(e);
      notify(e.message);
    });
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  onCommand(info.menuItemId, tab, info);
});

chrome.commands.onCommand.addListener(cmd => chrome.tabs.query({
  active: true,
  lastFocusedWindow: true
}, tabs => tabs && tabs[0] && onCommand(cmd, tabs[0])));

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
            tabs.query({active: true, lastFocusedWindow: true}, tbs => tabs.create({
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
