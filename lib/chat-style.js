const fs = require('node:fs');
const path = require('node:path');
const { backgroundColor } = require('./settings');
const baseCss = fs.readFileSync(path.join(__dirname, 'chat-base.css'), 'utf8');
const outlineCss = fs.readFileSync(path.join(__dirname, 'chat-outline.css'), 'utf8');
const outlineResetCss = fs.readFileSync(path.join(__dirname, 'chat-outline-reset.css'), 'utf8');

// Own every injected stylesheet, including updates that finish out of order.
class ChatStyle {
  constructor(view) {
    this.view = view;
    this.baseKey = undefined;
    this.outlineKey = undefined;
    this.revision = 0;
  }
  async apply(settings) {
    const contents = this.view.webContents;
    if (contents.isDestroyed()) return;
    const revision = ++this.revision;
    const snapshot = { ...settings };
    this.view.setBackgroundColor(backgroundColor(snapshot));
    // Keep the optional outline stylesheet separate so turning the setting off
    // explicitly removes rules that have already been injected.
    if (!snapshot.outlinedText && this.outlineKey) {
      const previousOutline = this.outlineKey;
      this.outlineKey = undefined;
      await contents.removeInsertedCSS(previousOutline).catch(() => {});
    }

    const css = baseCss +
      `:root { --overlay-header-background: ${backgroundColor(snapshot, 15)} !important; }`;
    const baseKey = await contents.insertCSS(css, { cssOrigin: 'user' });
    if (contents.isDestroyed()) return;
    if (revision !== this.revision) {
      await contents.removeInsertedCSS(baseKey).catch(() => {});
      return;
    }

    // OFF also gets an explicit reset sheet. Chromium can otherwise retain the
    // computed appearance after a user-origin stylesheet is removed.
    const outlineKey = await contents.insertCSS(
      snapshot.outlinedText ? outlineCss : outlineResetCss,
      { cssOrigin: 'user' }
    );
    if (contents.isDestroyed()) return;
    if (revision !== this.revision) {
      await Promise.all([
        contents.removeInsertedCSS(baseKey).catch(() => {}),
        contents.removeInsertedCSS(outlineKey).catch(() => {})
      ]);
      return;
    }

    const previousBase = this.baseKey;
    const previousOutline = this.outlineKey;
    this.baseKey = baseKey;
    this.outlineKey = outlineKey;
    contents.setZoomFactor(snapshot.fontScale / 100);
    await Promise.all([
      previousBase ? contents.removeInsertedCSS(previousBase).catch(() => {}) : Promise.resolve(),
      previousOutline ? contents.removeInsertedCSS(previousOutline).catch(() => {}) : Promise.resolve()
    ]);
  }
}
module.exports = { ChatStyle };
