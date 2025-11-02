/* global ceds */

if (typeof importScripts !== 'undefined') {
  self.importScripts('ceds.js');
}

const isFF = /Firefox/.test(navigator.userAgent);

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
}, id => setTimeout(chrome.notifications.clear, 5000, id));

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

async function capture(request) {
  const prefs = await chrome.storage.local.get({
    'format': 'png',
    'format-canvas': 'png',
    'quality': 0.95
  });

  const dataUrl = await chrome.tabs.captureVisibleTab(null, {
    format: prefs.format,
    quality: parseInt(prefs.quality * 100)
  });

  if (!request) {
    return fetch(dataUrl).then(r => r.blob());
  }

  const left = request.left * request.devicePixelRatio;
  const top = request.top * request.devicePixelRatio;
  const width = request.width * request.devicePixelRatio;
  const height = request.height * request.devicePixelRatio;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const r = await fetch(dataUrl);
  const blob = await r.blob();

  const img = await createImageBitmap(blob);

  if (width && height) {
    ctx.drawImage(img, left, top, width, height, 0, 0, width, height);
  }
  else {
    ctx.drawImage(img, 0, 0);
  }

  return canvas.convertToBlob({
    type: 'image/' + prefs['format-canvas'],
    quality: prefs.quality
  });
}

async function copy(content, tab) {
  // Firefox
  try {
    await navigator.clipboard.writeText(content);
  }
  catch (e) {
    try {
      await chrome.scripting.executeScript({
        target: {
          tabId: tab.id
        },
        func: content => {
          navigator.clipboard.writeText(content).catch(() => chrome.runtime.sendMessage({
            method: 'copy-interface',
            content
          }));
        },
        args: [content]
      });
    }
    catch (e) {
      copy.interface(content);
    }
  }
}
copy.interface = async (value, type = 'content') => {
  const win = await chrome.windows.getCurrent();
  const args = new URLSearchParams();
  args.set(type, value);

  chrome.windows.create({
    url: '/data/copy/index.html?' + args.toString(),
    width: 400,
    height: 300,
    left: win.left + Math.round((win.width - 400) / 2),
    top: win.top + Math.round((win.height - 300) / 2),
    type: 'popup'
  });
};

async function save(blob, tab) {
  const prefs = await chrome.storage.local.get({
    'saveAs': false,
    'save-disk': true,
    'edit-online': false,
    'save-clipboard': false,
    'mask': '[date] - [time] - [title]'
  });
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

  // convert to data uri with caching
  const href = () => {
    if (typeof blob === 'string') {
      return Promise.resolve(blob);
    }
    if (href.cache) {
      return Promise.resolve(href.cache);
    }

    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        href.cache = reader.result;
        resolve(reader.result);
      };
      reader.readAsDataURL(blob);
    });
  };

  // save to clipboard
  if (prefs['save-clipboard']) {
    chrome.scripting.executeScript({
      target: {tabId: tab.id},
      func: async href => {
        try {
          const r = await fetch(href);
          const blob = await r.blob();
          await navigator.clipboard.write([new ClipboardItem({
            [r.headers.get('content-type')]: blob
          })]);
        }
        catch (e) {
          chrome.runtime.sendMessage({
            method: 'save-to-clipboard',
            href
          });
        }
      },
      args: [await href()],
      injectImmediately: true
    });
  }
  // edit online
  if (prefs['edit-online']) {
    const hd = await href();
    const id = Math.random();
    save.cache[id] = hd;
    chrome.tabs.create({
      url: 'https://webbrowsertools.com/jspaint/pwa/build/index.html#gid=' + id
    });
  }
  // save to disk
  if (prefs['save-disk'] || (prefs['save-clipboard'] === false && prefs['edit-online'] === false)) {
    let mime = blob.type;
    let url;
    if (isFF) {
      if (typeof blob === 'string') {
        const b = await fetch(blob).then(r => r.blob());
        mime = b.type;
        url = URL.createObjectURL(b);
      }
      else {
        url = URL.createObjectURL(blob);
      }
    }
    else {
      url = await href();
    }
    mime = mime || url.split(',')[0].split(':')[1].split(';')[0];

    const extension = mime.split('/')[1].split(';')[0];
    chrome.downloads.download({
      url,
      filename: filename + '.' + extension,
      saveAs: prefs.saveAs
    }, () => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        chrome.downloads.download({
          url,
          filename: sanitizeFilename(filename) + '.' + extension,
          saveAs: prefs.saveAs
        }, () => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            chrome.downloads.download({
              url,
              filename: 'image.' + extension,
              saveAs: prefs.saveAs
            });
          }
        });
      }
    });
  }
}
save.cache = {};

async function matrix(tab) {
  const tabId = tab.id;
  const prefs = await chrome.storage.local.get({
    'delay': 600,
    'offset': 50,
    'quality': 0.95,
    'format-canvas': 'png'
  });
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
  let {ratio, width, height, w, h} = r[0].result;

  // OffscreenCanvasRenderingContext2D.drawImage: Canvas exceeds max size.
  if (isFF) {
    const ms = 32767 / ratio;
    width = Math.min(ms, width);
    height = Math.min(ms, height);
    w = Math.min(ms, w);
    h = Math.min(ms, h);
  }

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
    type: 'image/' + prefs['format-canvas'],
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
    if (once.done) {
      return;
    }
    once.done = true;

    chrome.contextMenus.create({
      'id': 'capture-portion',
      'title': 'Capture a Portion',
      'documentUrlPatterns': ['http://*/*', 'https://*/*'],
      'contexts': ['page', 'selection', 'link']
    });
    chrome.contextMenus.create({
      'id': 'capture-visual',
      'title': 'Capture Visual Part',
      'documentUrlPatterns': ['http://*/*', 'https://*/*'],
      'contexts': ['page', 'selection', 'link']
    });
    chrome.contextMenus.create({
      'id': 'capture-entire',
      'title': 'Capture Entire Screen (steps)',
      'documentUrlPatterns': ['http://*/*', 'https://*/*'],
      'contexts': ['page', 'selection', 'link']
    });
    chrome.contextMenus.create({
      'id': 'capture-entire-debugger',
      'title': 'Capture Entire Screen (debugger)',
      'documentUrlPatterns': ['http://*/*', 'https://*/*'],
      'contexts': ['page', 'selection', 'link'],
      'visible': isFF === false
    });
    chrome.contextMenus.create({
      'id': 'capture-entire-debugger-steps',
      'title': 'Capture Entire Screen (debugger + steps)',
      'documentUrlPatterns': ['http://*/*', 'https://*/*'],
      'contexts': ['page', 'selection', 'link'],
      'visible': isFF === false
    });
    chrome.contextMenus.create({
      'id': 'capture-element',
      'title': 'Capture Selected Element',
      'documentUrlPatterns': ['http://*/*', 'https://*/*'],
      'contexts': ['selection'],
      'visible': false
    });
  };

  chrome.runtime.onInstalled.addListener(once);
  chrome.runtime.onStartup.addListener(once);
}

async function capturewithdebugger(options, tab) {
  const target = {
    tabId: tab.id
  };

  await chrome.debugger.attach(target, '1.3');

  const prefs = await chrome.storage.local.get({
    format: 'png',
    quality: 0.95
  });

  try {
    const result = await chrome.debugger.sendCommand(target, 'Page.captureScreenshot', {
      format: prefs.format,
      quality: parseInt(prefs.quality * 100),
      ...options
    });
    if (!result) {
      throw Error('Failed to capture screenshot');
    }
    save('data:image/' + prefs.format + ';base64,' + result.data, tab);
    chrome.debugger.detach(target);
  }
  catch (e) {
    chrome.debugger.detach(target).catch(e => {});

    throw Error(e);
  }
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
  else if (request.method === 'popup') {
    onCommand(request.cmd, request.tab);

    response(true);
  }
  else if (request.method === 'copy-interface') {
    copy.interface(request.content);
  }
  else if (request.method === 'jspaint-load-resource') {
    chrome.scripting.executeScript({
      target: {
        tabId: sender.tab.id
      },
      func: (gid, href) => {
        if (typeof self.open_from_URI !== 'undefined') {
          self.open_from_URI(href);
          return true;
        }
        document.addEventListener('DOMContentLoaded', () => {
          self.open_from_URI(href);
        });
      },
      args: [request.gid, save.cache[request.gid]],
      world: 'MAIN'
    }).then(r => {
      // what if the PWA is not loaded
      if (r && r[0] && r[0].result === true) {
        delete save.cache[request.gid];
      }
    });
  }
  else if (request.method === 'read-gid') {
    response(save.cache[request.gid]);
    delete save.cache[request.gid];
  }
  else if (request.method === 'save-to-clipboard') {
    const gid = Math.random();
    save.cache[gid] = request.href;
    copy.interface(gid, 'gid');
  }
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const {homepage_url: page, name, version} = getManifest();
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
