/* globals content, sendAsyncMessage, addMessageListener, removeMessageListener */
'use strict';

function screenshot (e) {
  console.error(e.data, content.innerWidth);
  var thumbnail = content.document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
  var left = e.data.left || 0;
  var top = e.data.top || 0;
  var width = e.data.width || content.innerWidth;
  var height = e.data.height || content.innerHeight;
  thumbnail.width = width;
  thumbnail.height = height;
  var ctx = thumbnail.getContext('2d');
  ctx.drawWindow(content, content.scrollX + left, content.scrollY + top, width, height, 'rgb(255,255,255)');
  sendAsyncMessage('screenshot', thumbnail.toDataURL());
}
function download (e) {
  var link = content.document.createElement('a');
  link.setAttribute('style', 'display: none');
  link.download = e.data.name;
  link.href = e.data.uri;
  content.document.body.appendChild(link);
  link.click();
}

function detach () {
  removeMessageListener('screenshot', screenshot);
  removeMessageListener('download', download);
  removeMessageListener('detach', detach);
}

addMessageListener('screenshot', screenshot);
addMessageListener('download', download);
addMessageListener('detach', detach);
