const { app, BrowserWindow, BrowserView, globalShortcut, ipcMain, Menu } = require('electron');
const path = require('node:path');
const { DEFAULT_SETTINGS, normalizeSettings, backgroundColor, SettingsStore } = require('./lib/settings');
const { ChatStyle } = require('./lib/chat-style');
const securePreferences = { nodeIntegration: false, contextIsolation: true, sandbox: true, devTools: false };
const localPreferences = () => ({ ...securePreferences, preload: path.join(__dirname, 'preload.js') });
const appIcon = path.join(__dirname, 'build', 'icon.ico');

let mainWindow;
let chatView;
let settingsWindow;
let clickThrough = false;
let chatVisible = false;
let chatStyle;
let settingsStore;
let collapsed = false;
let expandedBounds;
let resizeSession;
let settings = { ...DEFAULT_SETTINGS };

function isAllowedChatUrl(value) {
  try {
    const url = new URL(value);
    const allowedHost = url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com';
    return url.protocol === 'https:' && allowedHost && url.pathname === '/live_chat';
  } catch {
    return false;
  }
}

function previewBackgroundAppearance(value, theme) {
  settings = normalizeSettings({ ...settings, backgroundOpacity: value, theme });
  injectTransparency().catch(console.error);
}

function layoutChatView() {
  if (!chatView || !mainWindow || mainWindow.isDestroyed()) return;
  if (!chatVisible || collapsed) {
    chatView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    return;
  }
  const [width, height] = mainWindow.getContentSize();
  // Keep an 8 px native hit-test area around the frameless window so that
  // the BrowserView cannot consume Windows' resize pointer events.
  chatView.setBounds({
    x: 8,
    y: 38,
    width: Math.max(1, width - 16),
    height: Math.max(1, height - 46)
  });
}

function ensureChatView() {
  if (chatView) return chatView;
  chatView = new BrowserView({
    webPreferences: { ...securePreferences }
  });
  chatStyle = new ChatStyle(chatView);
  chatView.setBackgroundColor(backgroundColor(settings));
  mainWindow.setBrowserView(chatView);
  chatView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  chatView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  chatView.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedChatUrl(url)) event.preventDefault();
  });
  chatView.webContents.on('did-finish-load', () => injectTransparency().catch(console.error));
  return chatView;
}

async function injectTransparency() {
  if (!chatView || chatView.webContents.isDestroyed()) return;
  if (!isAllowedChatUrl(chatView.webContents.getURL())) return;
  await chatStyle.apply(settings);
}

async function applySettings() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(settings.alwaysOnTop, settings.alwaysOnTop ? 'screen-saver' : 'normal');
    mainWindow.webContents.send('overlay:theme-changed', settings.theme);
  }
  if (chatView && !chatView.webContents.isDestroyed() && isAllowedChatUrl(chatView.webContents.getURL())) {
    await injectTransparency();
  }
}

function setChatVisibility(visible) {
  chatVisible = Boolean(visible);
  mainWindow?.webContents.send('overlay:chat-visibility-changed', chatVisible);
  layoutChatView();
}

function setClickThrough(enabled) {
  clickThrough = Boolean(enabled);
  if (!mainWindow || mainWindow.isDestroyed()) return clickThrough;
  mainWindow.setIgnoreMouseEvents(clickThrough, { forward: true });
  mainWindow.webContents.send('overlay:click-through-changed', clickThrough);
  return clickThrough;
}

function toggleCollapsed() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (!collapsed) {
    expandedBounds = mainWindow.getBounds();
    collapsed = true;
    mainWindow.setMinimumSize(280, 40);
    mainWindow.setResizable(false);
    mainWindow.setBounds({ x: expandedBounds.x, y: expandedBounds.y, width: expandedBounds.width, height: 40 }, true);
  } else {
    collapsed = false;
    mainWindow.setBounds(expandedBounds, true);
    mainWindow.setMinimumSize(280, 240);
    mainWindow.setResizable(true);
  }
  layoutChatView();
  mainWindow.webContents.send('overlay:collapsed-changed', collapsed);
  return collapsed;
}

function startManualResize(edge, point) {
  const validEdges = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);
  if (!mainWindow || mainWindow.isDestroyed() || collapsed || !validEdges.has(edge)) return;
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
  resizeSession = { edge, point, bounds: mainWindow.getBounds() };
}

function updateManualResize(point) {
  if (!resizeSession || !mainWindow || mainWindow.isDestroyed()) return;
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;

  const { edge, bounds, point: startPoint } = resizeSession;
  const dx = point.x - startPoint.x;
  const dy = point.y - startPoint.y;
  const minimumWidth = 280;
  const minimumHeight = 240;
  let { x, y, width, height } = bounds;

  if (edge.includes('e')) width = Math.max(minimumWidth, bounds.width + dx);
  if (edge.includes('s')) height = Math.max(minimumHeight, bounds.height + dy);
  if (edge.includes('w')) {
    width = Math.max(minimumWidth, bounds.width - dx);
    x = bounds.x + bounds.width - width;
  }
  if (edge.includes('n')) {
    height = Math.max(minimumHeight, bounds.height - dy);
    y = bounds.y + bounds.height - height;
  }

  mainWindow.setBounds({
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height)
  });
}

function endManualResize() {
  resizeSession = undefined;
}

async function showLauncher() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (collapsed) toggleCollapsed();
  setClickThrough(false);
  setChatVisibility(false);
  mainWindow.focus();
}

async function loadChatUrl(url) {
  if (!isAllowedChatUrl(url)) throw new Error('YouTube Live Chat pop-out URLを入力してください。');
  setClickThrough(false);
  const view = ensureChatView();
  await view.webContents.loadURL(url);
  setChatVisibility(true);
}

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    title: 'Overlay 設定', width: 420, height: 560,
    resizable: false, minimizable: false, maximizable: false,
    parent: mainWindow, alwaysOnTop: true,
    icon: appIcon,
    webPreferences: localPreferences()
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWindow.on('closed', () => {
    settingsWindow = undefined;
    settings = { ...settingsStore.value };
    applySettings().catch(console.error);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'YouTube Live Chat Overlay', width: 430, height: 760,
    minWidth: 280, minHeight: 240,
    transparent: true, backgroundColor: '#00000000',
    frame: false, thickFrame: true, alwaysOnTop: settings.alwaysOnTop, resizable: true, show: false,
    icon: appIcon,
    webPreferences: localPreferences()
  });
  mainWindow.setAlwaysOnTop(settings.alwaysOnTop, settings.alwaysOnTop ? 'screen-saver' : 'normal');
  mainWindow.setMenuBarVisibility(false);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable && !params.selectionText) return;
    const template = params.isEditable ? [
      { label: '元に戻す', role: 'undo', enabled: params.editFlags.canUndo },
      { label: 'やり直す', role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { label: '切り取り', role: 'cut', enabled: params.editFlags.canCut },
      { label: 'コピー', role: 'copy', enabled: params.editFlags.canCopy },
      { label: '貼り付け', role: 'paste', enabled: params.editFlags.canPaste },
      { label: '削除', role: 'delete', enabled: params.editFlags.canDelete },
      { type: 'separator' },
      { label: 'すべて選択', role: 'selectAll' }
    ] : [{ label: 'コピー', role: 'copy', enabled: params.editFlags.canCopy }];
    Menu.buildFromTemplate(template).popup({ window: mainWindow });
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.control && input.shift && (input.key === '9' || input.code === 'Digit9')) {
      event.preventDefault();
      setClickThrough(!clickThrough);
    }
    else if (input.control && input.key.toLowerCase() === 'l') { event.preventDefault(); showLauncher(); }
    else if (input.control && input.shift && input.key.toLowerCase() === 'q') { event.preventDefault(); mainWindow.close(); }
  });
  mainWindow.on('resize', layoutChatView);
  mainWindow.on('closed', () => {
    if (chatView && !chatView.webContents.isDestroyed()) chatView.webContents.close();
    chatView = undefined;
    chatStyle = undefined;
    mainWindow = undefined;
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  app.setAppUserModelId('jp.local.youtube-live-chat-overlay');
  settingsStore = new SettingsStore(path.join(app.getPath('userData'), 'settings.json'));
  settings = { ...settingsStore.value };
  ipcMain.handle('overlay:load-chat', (_event, url) => loadChatUrl(url));
  ipcMain.handle('overlay:toggle-click-through', () => setClickThrough(!clickThrough));
  ipcMain.handle('overlay:get-click-through', () => clickThrough);
  ipcMain.handle('overlay:show-launcher', showLauncher);
  ipcMain.handle('overlay:close', () => mainWindow?.close());
  ipcMain.handle('overlay:open-settings', openSettingsWindow);
  ipcMain.handle('overlay:close-settings', () => settingsWindow?.close());
  ipcMain.handle('overlay:toggle-collapsed', toggleCollapsed);
  ipcMain.on('overlay:resize-start', (_event, edge, point) => startManualResize(edge, point));
  ipcMain.on('overlay:resize-move', (_event, point) => updateManualResize(point));
  ipcMain.on('overlay:resize-end', endManualResize);
  ipcMain.handle('overlay:get-settings', () => settings);
  ipcMain.on('overlay:preview-background', (_event, value, theme) => previewBackgroundAppearance(value, theme));
  ipcMain.handle('overlay:update-settings', async (_event, value) => {
    settings = settingsStore.commit(value);
    await applySettings();
    return settings;
  });
  createWindow();
  globalShortcut.register('CommandOrControl+Shift+9', () => setClickThrough(!clickThrough));
  globalShortcut.register('CommandOrControl+L', showLauncher);
  globalShortcut.register('CommandOrControl+Shift+Q', () => mainWindow?.close());
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
