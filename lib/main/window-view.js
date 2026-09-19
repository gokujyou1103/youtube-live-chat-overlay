function editMenuTemplate(params) {
  if (!params.isEditable) return [{ label: 'コピー', role: 'copy', enabled: params.editFlags.canCopy }];
  return [
    { label: '元に戻す', role: 'undo', enabled: params.editFlags.canUndo },
    { label: 'やり直す', role: 'redo', enabled: params.editFlags.canRedo },
    { type: 'separator' },
    { label: '切り取り', role: 'cut', enabled: params.editFlags.canCut },
    { label: 'コピー', role: 'copy', enabled: params.editFlags.canCopy },
    { label: '貼り付け', role: 'paste', enabled: params.editFlags.canPaste },
    { label: '削除', role: 'delete', enabled: params.editFlags.canDelete },
    { type: 'separator' },
    { label: 'すべて選択', role: 'selectAll' }
  ];
}

function createMainWindow({ BrowserWindow, Menu, icon, preload, settings, rendererFile, actions }) {
  const window = new BrowserWindow({
    title: 'YouTube Live Chat Overlay', width: 430, height: 760,
    minWidth: 280, minHeight: 240,
    transparent: true, backgroundColor: '#00000000', frame: false, thickFrame: true,
    alwaysOnTop: settings.alwaysOnTop, resizable: true, show: false, icon,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, devTools: false, preload }
  });
  window.setAlwaysOnTop(settings.alwaysOnTop, settings.alwaysOnTop ? 'screen-saver' : 'normal');
  window.setMenuBarVisibility(false);
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable && !params.selectionText) return;
    Menu.buildFromTemplate(editMenuTemplate(params)).popup({ window });
  });
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.control && input.shift && (input.key === '9' || input.code === 'Digit9')) {
      event.preventDefault(); actions.toggleClickThrough();
    } else if (input.control && input.key.toLowerCase() === 'l') {
      event.preventDefault(); actions.showLauncher();
    } else if (input.control && input.shift && input.key.toLowerCase() === 'q') {
      event.preventDefault(); actions.close();
    }
  });
  window.on('resize', actions.layout);
  window.on('closed', actions.closed);
  window.loadFile(rendererFile);
  return window;
}

function createSettingsWindow({ BrowserWindow, parent, icon, preload, rendererFile, onClosed }) {
  const window = new BrowserWindow({
    title: 'Overlay 設定', width: 420, height: 560, resizable: false,
    minimizable: false, maximizable: false, parent, alwaysOnTop: true, icon,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, devTools: false, preload }
  });
  window.setMenuBarVisibility(false);
  window.loadFile(rendererFile);
  window.on('closed', onClosed);
  return window;
}

module.exports = { createMainWindow, createSettingsWindow, editMenuTemplate };
