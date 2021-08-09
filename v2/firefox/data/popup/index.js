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
        title: tab.title
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
  'save-disk': true
}, prefs => {
  document.getElementById('save-clipboard').checked = prefs['save-clipboard'];
  document.getElementById('save-disk').checked = prefs['save-disk'];
});

document.getElementById('save-clipboard').onchange = e => {
  if (e.target.checked) {
    chrome.permissions.request({
      permissions: ['clipboardWrite'],
      origins: []
    }, granted => {
      if (granted === false) {
        e.target.checked = false;
      }
      console.log(e.target.checked);
      chrome.storage.local.set({
        'save-clipboard': e.target.checked
      });
    });
  }
  else {
    chrome.storage.local.set({
      'save-clipboard': e.target.checked
    });
  }
};
document.getElementById('save-disk').onchange = e => chrome.storage.local.set({
  'save-disk': e.target.checked
});
