'use strict';

function restore () {
  chrome.storage.local.get({
    delay: 500,
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

function save () {
  let delay = Math.max(document.getElementById('delay').value, 100);
  let offset = Math.max(document.getElementById('offset').value, 10);
  let timestamp = document.getElementById('timestamp').checked;
  let saveAs = document.getElementById('saveAs').checked;

  chrome.storage.local.set({
    delay,
    offset,
    timestamp,
    saveAs
  }, () => {
    let status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(() => status.textContent = '', 750);
    restore();
  });
}

document.addEventListener('DOMContentLoaded', restore);
document.getElementById('save').addEventListener('click', save);
