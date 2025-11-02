'use strict';

const toast = document.getElementById('toast');

function restore() {
  chrome.storage.local.get({
    'delay': 600,
    'offset': 50,
    'mask': '[date] - [time] - [title]',
    'saveAs': false,
    'format': 'png',
    'format-canvas': 'png',
    'quality': 0.95
  }, prefs => {
    document.getElementById('delay').value = prefs.delay;
    document.getElementById('offset').value = prefs.offset;
    document.getElementById('mask').value = prefs.mask;
    document.getElementById('saveAs').checked = prefs.saveAs;
    document.getElementById('format').value = prefs.format;
    document.getElementById('format-canvas').value = prefs['format-canvas'];
    document.getElementById('quality').value = prefs.quality;
  });
}

function save() {
  const delay = Math.max(document.getElementById('delay').value, 100);
  const offset = Math.max(document.getElementById('offset').value, 10);
  const mask = document.getElementById('mask').value;
  const saveAs = document.getElementById('saveAs').checked;
  const format = document.getElementById('format').value;
  const quality = Math.min(Math.max(document.getElementById('quality').valueAsNumber, 0.3), 1);

  chrome.storage.local.set({
    delay,
    offset,
    mask,
    saveAs,
    format,
    quality,
    'format-canvas': document.getElementById('format-canvas').value
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

// links
for (const a of [...document.querySelectorAll('[data-href]')]) {
  if (a.hasAttribute('href') === false) {
    a.href = chrome.runtime.getManifest().homepage_url + '#' + a.dataset.href;
  }
}
