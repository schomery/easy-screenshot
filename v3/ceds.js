// eslint-disable-next-line no-unused-vars
const ceds = async tab => {
  const target = {
    tabId: tab.id
  };

  const tabId = tab.id;
  chrome.action.setBadgeText({tabId, text: 'R'});

  const r = await chrome.scripting.executeScript({
    target,
    func: () => {
      const width = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
      const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      window.scrollTo({
        left: 0,
        top: 0,
        behavior: 'instant'
      });

      return {
        ratio: window.devicePixelRatio,
        width,
        height
      };
    },
    injectImmediately: true
  });

  await chrome.debugger.attach(target, '1.3');

  const info = r[0].result;

  const prefs = await chrome.storage.local.get({
    'delay': 600,
    'step': 2000,
    'quality': 0.95,
    'format': 'png',
    'format-canvas': 'png'
  });

  const mx = Math.ceil(info.width / prefs.step) * Math.ceil(info.height / prefs.step);
  let p = 0;

  const section = async rect => {
    // await chrome.scripting.executeScript({
    //   target,
    //   func: rect => window.scrollTo({
    //     left: rect.x,
    //     top: rect.y,
    //     behavior: 'instant'
    //   }),
    //   args: [rect]
    // });
    await new Promise(resolve => setTimeout(resolve, prefs.delay));
    const result = await chrome.debugger.sendCommand(target, 'Page.captureScreenshot', {
      format: prefs.format,
      quality: parseInt(prefs.quality * 100),
      captureBeyondViewport: true,
      clip: {
        ...rect,
        scale: 1
      }
    });

    if (!result) {
      throw Error('Failed to capture screenshot');
    }
    return 'data:image/' + prefs.format + ';base64,' + result.data;
  };

  const canvas = new OffscreenCanvas(info.width * info.ratio, info.height * info.ratio);
  const ctx = canvas.getContext('2d');

  try {
    for (let x = 0; x < info.width; x += prefs.step) {
      for (let y = 0; y < info.height; y += prefs.step) {
        p += 1;
        chrome.action.setBadgeText({tabId, text: (p / mx * 100).toFixed(0) + '%'});

        const width = Math.min(x + prefs.step, info.width) - x;
        const height = Math.min(y + prefs.step, info.height) - y;

        const du = await section({
          x,
          y,
          width,
          height
        });
        const b = await fetch(du).then(r => r.blob());
        const img = await createImageBitmap(b);
        ctx.drawImage(
          img,
          0, 0, img.width, img.height,
          x * info.ratio, y * info.ratio, img.width, img.height
        );
      }
    }
    chrome.action.setBadgeText({tabId, text: '...'});
    chrome.debugger.detach(target);

    return canvas.convertToBlob({
      type: 'image/' + prefs['format-canvas'],
      quality: prefs.quality
    }).then(du => {
      chrome.action.setBadgeText({tabId, text: ''});
      return du;
    });
  }
  catch (e) {
    chrome.action.setBadgeText({tabId, text: ''});
    chrome.debugger.detach(target);
    throw e;
  }
};
