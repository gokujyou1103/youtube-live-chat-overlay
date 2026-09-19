const path = require('node:path');
const { normalizeSettings, backgroundColor } = require('../settings');
const { ChatStyle } = require('../chat-style');
const { isAllowedChatUrl } = require('./chat-url');
const { createMainWindow, createSettingsWindow } = require('./window-view');

const SECURE_PREFERENCES = { nodeIntegration: false, contextIsolation: true, sandbox: true, devTools: false };
const VALID_RESIZE_EDGES = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);

class OverlayController {
  constructor({ electron, settingsStore, rootDirectory }) {
    this.electron = electron;
    this.settingsStore = settingsStore;
    this.rootDirectory = rootDirectory;
    this.settings = { ...settingsStore.value };
    this.clickThrough = false;
    this.chatVisible = false;
    this.collapsed = false;
  }

  createWindow() {
    const { BrowserWindow, Menu } = this.electron;
    this.mainWindow = createMainWindow({
      BrowserWindow, Menu, settings: this.settings,
      icon: path.join(this.rootDirectory, 'build', 'icon.ico'),
      preload: path.join(this.rootDirectory, 'preload.js'),
      rendererFile: path.join(this.rootDirectory, 'renderer', 'index.html'),
      actions: {
        toggleClickThrough: () => this.toggleClickThrough(),
        showLauncher: () => this.showLauncher(),
        close: () => this.close(),
        layout: () => this.layoutChatView(),
        closed: () => this.onMainWindowClosed()
      }
    });
  }

  ensureChatView() {
    if (this.chatView) return this.chatView;
    this.chatView = new this.electron.BrowserView({ webPreferences: { ...SECURE_PREFERENCES } });
    this.chatStyle = new ChatStyle(this.chatView);
    this.chatView.setBackgroundColor(backgroundColor(this.settings));
    this.mainWindow.setBrowserView(this.chatView);
    this.chatView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    this.chatView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.chatView.webContents.on('will-navigate', (event, url) => {
      if (!isAllowedChatUrl(url)) event.preventDefault();
    });
    this.chatView.webContents.on('did-finish-load', () => this.injectTransparency().catch(console.error));
    return this.chatView;
  }

  layoutChatView() {
    if (!this.chatView || !this.mainWindow || this.mainWindow.isDestroyed()) return;
    if (!this.chatVisible || this.collapsed) {
      this.chatView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      return;
    }
    const [width, height] = this.mainWindow.getContentSize();
    this.chatView.setBounds({ x: 8, y: 38, width: Math.max(1, width - 16), height: Math.max(1, height - 46) });
  }

  async injectTransparency() {
    if (!this.chatView || this.chatView.webContents.isDestroyed()) return;
    if (!isAllowedChatUrl(this.chatView.webContents.getURL())) return;
    await this.chatStyle.apply(this.settings);
  }

  async applySettings() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.setAlwaysOnTop(this.settings.alwaysOnTop, this.settings.alwaysOnTop ? 'screen-saver' : 'normal');
      this.mainWindow.webContents.send('overlay:theme-changed', this.settings.theme);
    }
    await this.injectTransparency();
  }

  previewBackground(value, theme) {
    this.settings = normalizeSettings({ ...this.settings, backgroundOpacity: value, theme });
    this.injectTransparency().catch(console.error);
  }

  async updateSettings(value) {
    this.settings = this.settingsStore.commit(value);
    await this.applySettings();
    return this.settings;
  }

  setChatVisibility(visible) {
    this.chatVisible = Boolean(visible);
    this.mainWindow?.webContents.send('overlay:chat-visibility-changed', this.chatVisible);
    this.layoutChatView();
  }

  setClickThrough(enabled) {
    this.clickThrough = Boolean(enabled);
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return this.clickThrough;
    this.mainWindow.setIgnoreMouseEvents(this.clickThrough, { forward: true });
    this.mainWindow.webContents.send('overlay:click-through-changed', this.clickThrough);
    return this.clickThrough;
  }

  toggleClickThrough() { return this.setClickThrough(!this.clickThrough); }

  toggleCollapsed() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return false;
    if (!this.collapsed) {
      this.expandedBounds = this.mainWindow.getBounds();
      this.collapsed = true;
      this.mainWindow.setMinimumSize(280, 40);
      this.mainWindow.setResizable(false);
      this.mainWindow.setBounds({ ...this.expandedBounds, height: 40 }, true);
    } else {
      this.collapsed = false;
      this.mainWindow.setBounds(this.expandedBounds, true);
      this.mainWindow.setMinimumSize(280, 240);
      this.mainWindow.setResizable(true);
    }
    this.layoutChatView();
    this.mainWindow.webContents.send('overlay:collapsed-changed', this.collapsed);
    return this.collapsed;
  }

  startManualResize(edge, point) {
    if (!this.mainWindow || this.mainWindow.isDestroyed() || this.collapsed || !VALID_RESIZE_EDGES.has(edge)) return;
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
    this.resizeSession = { edge, point, bounds: this.mainWindow.getBounds() };
  }

  updateManualResize(point) {
    if (!this.resizeSession || !this.mainWindow || this.mainWindow.isDestroyed()) return;
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
    const { edge, bounds, point: start } = this.resizeSession;
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    let { x, y, width, height } = bounds;
    if (edge.includes('e')) width = Math.max(280, bounds.width + dx);
    if (edge.includes('s')) height = Math.max(240, bounds.height + dy);
    if (edge.includes('w')) { width = Math.max(280, bounds.width - dx); x = bounds.x + bounds.width - width; }
    if (edge.includes('n')) { height = Math.max(240, bounds.height - dy); y = bounds.y + bounds.height - height; }
    this.mainWindow.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
  }

  endManualResize() { this.resizeSession = undefined; }

  showLauncher() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    if (this.collapsed) this.toggleCollapsed();
    this.setClickThrough(false);
    this.setChatVisibility(false);
    this.mainWindow.focus();
  }

  async loadChatUrl(url) {
    if (!isAllowedChatUrl(url)) throw new Error('YouTube Live Chat pop-out URLを入力してください。');
    this.setClickThrough(false);
    await this.ensureChatView().webContents.loadURL(url);
    this.setChatVisibility(true);
  }

  openSettingsWindow() {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) return this.settingsWindow.focus();
    this.settingsWindow = createSettingsWindow({
      BrowserWindow: this.electron.BrowserWindow,
      parent: this.mainWindow,
      icon: path.join(this.rootDirectory, 'build', 'icon.ico'),
      preload: path.join(this.rootDirectory, 'preload.js'),
      rendererFile: path.join(this.rootDirectory, 'renderer', 'settings.html'),
      onClosed: () => {
        this.settingsWindow = undefined;
        this.settings = { ...this.settingsStore.value };
        this.applySettings().catch(console.error);
      }
    });
  }

  closeSettingsWindow() { this.settingsWindow?.close(); }
  close() { this.mainWindow?.close(); }

  onMainWindowClosed() {
    if (this.chatView && !this.chatView.webContents.isDestroyed()) this.chatView.webContents.close();
    this.chatView = undefined;
    this.chatStyle = undefined;
    this.mainWindow = undefined;
  }
}

module.exports = { OverlayController };
