'use strict';

let tab;

document.addEventListener('click', e => {
  const cmd = e.target.dataset.cmd;
  if (cmd) {
    chrome.runtime.sendMessage({
      method: 'popup',
      cmd,
      tab: {
        id: tab.id,
        title: tab.title,
        windowId: tab.windowId
      }
    }, window.close);
  }
});

chrome.tabs.query({
  active: true,
  currentWindow: true
}, ([t]) => {
  tab = t;
  if (
    tab.url.startsWith('chrome') ||
    tab.url.startsWith('mozilla') ||
    tab.url.startsWith('about')
  ) {
    document.body.dataset.disabled = true;
  }
});

chrome.storage.local.get({
  'save-clipboard': false,
  'save-disk': true,
  'edit-online': false
}, prefs => {
  document.getElementById('save-clipboard').checked = prefs['save-clipboard'];
  document.getElementById('save-disk').checked = prefs['save-disk'];
  document.getElementById('edit-online').checked = prefs['edit-online'];
});

document.getElementById('save-clipboard').onchange = e => {
  chrome.storage.local.set({
    'save-clipboard': e.target.checked
  });
};
document.getElementById('save-disk').onchange = e => chrome.storage.local.set({
  'save-disk': e.target.checked
});
document.getElementById('edit-online').onchange = e => chrome.storage.local.set({
  'edit-online': e.target.checked
});
