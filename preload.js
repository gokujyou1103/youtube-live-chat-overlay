const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

// The control API is exposed only to the bundled launcher, never to YouTube.
if (window.location.protocol === 'file:') {
  contextBridge.exposeInMainWorld('overlay', {
    loadChat: (url) => ipcRenderer.invoke('overlay:load-chat', url),
    toggleClickThrough: () => ipcRenderer.invoke('overlay:toggle-click-through'),
    getClickThrough: () => ipcRenderer.invoke('overlay:get-click-through'),
    showLauncher: () => ipcRenderer.invoke('overlay:show-launcher'),
    close: () => ipcRenderer.invoke('overlay:close'),
    openSettings: () => ipcRenderer.invoke('overlay:open-settings'),
    closeSettings: () => ipcRenderer.invoke('overlay:close-settings'),
    toggleCollapsed: () => ipcRenderer.invoke('overlay:toggle-collapsed'),
    startResize: (edge, point) => ipcRenderer.send('overlay:resize-start', edge, point),
    moveResize: (point) => ipcRenderer.send('overlay:resize-move', point),
    endResize: () => ipcRenderer.send('overlay:resize-end'),
    getSettings: () => ipcRenderer.invoke('overlay:get-settings'),
    updateSettings: (settings) => ipcRenderer.invoke('overlay:update-settings', settings),
    previewBackground: (value, theme) => ipcRenderer.send('overlay:preview-background', value, theme),
    onClickThroughChanged: (callback) => subscribe('overlay:click-through-changed', callback),
    onChatVisibilityChanged: (callback) => subscribe('overlay:chat-visibility-changed', callback),
    onCollapsedChanged: (callback) => subscribe('overlay:collapsed-changed', callback),
    onThemeChanged: (callback) => subscribe('overlay:theme-changed', callback)
  });
}
