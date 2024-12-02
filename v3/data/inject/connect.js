// open the requested gid on jsPaint
if (location.hash.includes('gid=')) {
  const gid = location.hash.split('gid=')[1];
  document.addEventListener('DOMContentLoaded', () => chrome.runtime.sendMessage({
    method: 'jspaint-ready',
    gid
  }));
}
