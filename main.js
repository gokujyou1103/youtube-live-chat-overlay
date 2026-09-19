const electron = require('electron');
const path = require('node:path');
const { SettingsStore } = require('./lib/settings');
const { OverlayController } = require('./lib/main/overlay-controller');
const { registerIpc } = require('./lib/main/ipc');

const { app, globalShortcut } = electron;
let controller;

app.whenReady().then(() => {
  app.setAppUserModelId('jp.local.youtube-live-chat-overlay');
  const settingsStore = new SettingsStore(path.join(app.getPath('userData'), 'settings.json'));
  controller = new OverlayController({ electron, settingsStore, rootDirectory: __dirname });

  registerIpc(electron.ipcMain, controller);
  controller.createWindow();
  globalShortcut.register('CommandOrControl+Shift+9', () => controller.toggleClickThrough());
  globalShortcut.register('CommandOrControl+L', () => controller.showLauncher());
  globalShortcut.register('CommandOrControl+Shift+Q', () => controller.close());
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
