'use strict';

const toast = document.getElementById('toast');

function restore() {
  chrome.storage.local.get({
    delay: 600,
    offset: 50,
    timestamp: true,
    saveAs: false
  }, prefs => {
    document.getElementById('delay').value = prefs.delay;
    document.getElementById('offset').value = prefs.offset;
    document.getElementById('timestamp').checked = prefs.timestamp;
    document.getElementById('saveAs').checked = prefs.saveAs;
  });
}

function save() {
  const delay = Math.max(document.getElementById('delay').value, 100);
  const offset = Math.max(document.getElementById('offset').value, 10);
  const timestamp = document.getElementById('timestamp').checked;
  const saveAs = document.getElementById('saveAs').checked;

  chrome.storage.local.set({
    delay,
    offset,
    timestamp,
    saveAs
  }, () => {
    toast.textContent = 'Options saved.';
    setTimeout(() => toast.textContent = '', 750);
    restore();
  });
}

document.addEventListener('DOMContentLoaded', restore);
document.getElementById('save').addEventListener('click', save);

// reset
document.getElementById('reset').addEventListener('click', e => {
  if (e.detail === 1) {
    toast.textContent = 'Double-click to reset!';
    window.setTimeout(() => toast.textContent = '', 750);
  }
  else {
    localStorage.clear();
    chrome.storage.local.clear(() => {
      chrome.runtime.reload();
      window.close();
    });
  }
});
// support
document.getElementById('support').addEventListener('click', () => chrome.tabs.create({
  url: chrome.runtime.getManifest().homepage_url + '?rd=donate'
}));
// preview
document.getElementById('yt').addEventListener('click', () => chrome.tabs.create({
  url: 'https://www.youtube.com/watch?v=BfUtaaGO4HA'
}));
