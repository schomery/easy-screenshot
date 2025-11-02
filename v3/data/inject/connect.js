// open the requested gid on jsPaint
if (location.hash.includes('gid=')) {
  const gid = location.hash.split('gid=')[1];
  chrome.runtime.sendMessage({
    method: 'jspaint-load-resource',
    gid
  });
}

