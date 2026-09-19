function registerIpc(ipcMain, controller) {
  ipcMain.handle('overlay:load-chat', (_event, url) => controller.loadChatUrl(url));
  ipcMain.handle('overlay:toggle-click-through', () => controller.toggleClickThrough());
  ipcMain.handle('overlay:get-click-through', () => controller.clickThrough);
  ipcMain.handle('overlay:show-launcher', () => controller.showLauncher());
  ipcMain.handle('overlay:close', () => controller.close());
  ipcMain.handle('overlay:open-settings', () => controller.openSettingsWindow());
  ipcMain.handle('overlay:close-settings', () => controller.closeSettingsWindow());
  ipcMain.handle('overlay:toggle-collapsed', () => controller.toggleCollapsed());
  ipcMain.on('overlay:resize-start', (_event, edge, point) => controller.startManualResize(edge, point));
  ipcMain.on('overlay:resize-move', (_event, point) => controller.updateManualResize(point));
  ipcMain.on('overlay:resize-end', () => controller.endManualResize());
  ipcMain.handle('overlay:get-settings', () => controller.settings);
  ipcMain.on('overlay:preview-background', (_event, value, theme) => controller.previewBackground(value, theme));
  ipcMain.handle('overlay:update-settings', (_event, value) => controller.updateSettings(value));
}

module.exports = { registerIpc };
