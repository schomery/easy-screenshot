// eslint-disable-next-line no-unused-vars
const ceds = tab => {
  const target = {
    tabId: tab.id
  };

  const tabId = tab.id;
  chrome.action.setBadgeText({tabId, text: 'R'});

  return chrome.scripting.executeScript({
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
  }).then(r => new Promise((resolve, reject) => chrome.debugger.attach(target, '1.3', async () => {
    const lastError = chrome.runtime.lastError;

    if (lastError) {
      return reject(lastError);
    }

    const info = r[0].result;

    const prefs = await new Promise(resolve => chrome.storage.local.get({
      delay: 600,
      step: 2000,
      quality: 0.95
    }, resolve));

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
      return new Promise((resolve, reject) => chrome.debugger.sendCommand(target, 'Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: {
          ...rect,
          scale: 1
        }
      }, result => {
        const lastError = chrome.runtime.lastError;

        if (lastError) {
          reject(lastError);
        }
        else if (!result) {
          reject(Error('Failed to capture screenshot'));
        }
        else {
          resolve('data:image/png;base64,' + result.data, tab);
        }
      }));
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
      canvas.convertToBlob({
        type: 'image/png',
        quality: prefs.quality
      }).then(du => {
        chrome.action.setBadgeText({tabId, text: ''});
        resolve(du);
      }, reject);
    }
    catch (e) {
      chrome.action.setBadgeText({tabId, text: ''});
      chrome.debugger.detach(target);
      throw e;
    }
  })));
};
