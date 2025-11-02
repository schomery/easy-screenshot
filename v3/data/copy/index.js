const args = new URLSearchParams(location.search);

const copy = async e => {
  let timeout = 1000;

  try {
    if (args.has('content')) {
      await navigator.clipboard.writeText(args.get('content'));
    }
    else if (args.has('gid')) {
      const href = copy.href || await chrome.runtime.sendMessage({
        method: 'read-gid',
        gid: args.get('gid')
      });
      copy.href = href;
      const r = await fetch(href);
      const blob = await r.blob();
      const mime = r.headers.get('content-type');

      try {
        await navigator.clipboard.write([new ClipboardItem({
          [mime]: blob
        })]);
      }
      catch (e) {
        // if format is not supported
        if (mime.includes('png') === false) {
          document.getElementById('toast').textContent =
            'Clipboard API does not yet suppot "' + blob.type + '". Storing PNG instead...';
          timeout = 5000;

          const img = await createImageBitmap(blob);
          const canvas = new OffscreenCanvas(img.width, img.height);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const pngBlob = await canvas.convertToBlob({
            type: 'image/png'
          });

          await navigator.clipboard.write([
            new ClipboardItem({
              [pngBlob.type]: pngBlob
            })
          ]);
        }
        else {
          throw e;
        }
      }
    }
    else {
      throw Error('NO_SUPPORTED_ARG');
    }
    await new Promise(resolve => setTimeout(resolve, e && e.isTrusted ? 0 : timeout));
    window.close();
  }
  catch (err) {
    console.error(err);
    if (e?.isTrusted) {
      alert(err.message);
    }
  }
};

copy();
document.getElementById('copy').addEventListener('click', copy);
