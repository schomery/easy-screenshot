'use strict';

var tab;

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
