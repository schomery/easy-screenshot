const args = new URLSearchParams(location.search);

const copy = async e => {
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
      const blob = await fetch(href).then(r => r.blob());
      await navigator.clipboard.write([new ClipboardItem({
        'image/png': blob
      })]);
    }
    else {
      throw Error('NO_SUPPORTED_ARG');
    }
    await new Promise(resolve => setTimeout(resolve, e && e.isTrusted ? 0 : 1000));
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
