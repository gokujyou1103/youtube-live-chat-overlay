const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DEFAULT_SETTINGS, normalizeSettings, SettingsStore, backgroundColor } = require('../lib/settings');
const { ChatStyle } = require('../lib/chat-style');

test('legacy and malformed settings normalize without losing valid preferences', () => {
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  const result = normalizeSettings({ backgroundOpacity: 140, fontScale: Infinity, theme: 'unknown', alwaysOnTop: false });
  assert.equal(result.backgroundOpacity, 100);
  assert.equal(result.fontScale, 100);
  assert.equal(result.theme, 'gray');
  assert.equal(result.alwaysOnTop, false);
  assert.equal(backgroundColor({ ...DEFAULT_SETTINGS, theme: 'pink', backgroundOpacity: 50 }), 'rgba(244, 184, 202, 0.5)');
});

test('preview does not alter committed settings; commit survives reopening', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-settings-test-'));
  const filename = path.join(directory, 'settings.json');
  try {
    const store = new SettingsStore(filename);
    const draft = normalizeSettings({ ...store.value, theme: 'pink', backgroundOpacity: 60 });
    assert.equal(store.value.theme, 'gray');
    assert.equal(fs.existsSync(filename), false);
    store.commit(draft);
    assert.deepEqual(new SettingsStore(filename).value, draft);
  } finally {
    if (fs.existsSync(filename)) fs.unlinkSync(filename);
    fs.rmdirSync(directory);
  }
});

test('out-of-order CSS completion removes stale outlines and retains latest style', async () => {
  const pending = [];
  const active = new Map();
  let counter = 0;
  const contents = {
    isDestroyed: () => false,
    insertCSS: (css) => new Promise((resolve) => {
      const key = String(++counter);
      pending.push(() => { active.set(key, css); resolve(key); });
    }),
    removeInsertedCSS: async (key) => { active.delete(key); },
    setZoomFactor: () => {}
  };
  const style = new ChatStyle({ webContents: contents, setBackgroundColor: () => {} });
  const first = style.apply({ ...DEFAULT_SETTINGS, outlinedText: true });
  const second = style.apply(DEFAULT_SETTINGS);
  pending[1]();
  await new Promise((resolve) => setImmediate(resolve));
  pending[2]();
  await second;
  pending[0]();
  await first;
  assert.equal(active.size, 2);
  assert.ok([...active.values()].some((css) => css.includes('text-shadow: revert')));
  const third = style.apply({ ...DEFAULT_SETTINGS, outlinedText: true });
  pending[3]();
  await new Promise((resolve) => setImmediate(resolve));
  pending[4]();
  await third;
  assert.equal(active.size, 2);
  assert.ok([...active.values()].some((css) => css.includes('#000000')));

  const fourth = style.apply(DEFAULT_SETTINGS);
  await new Promise((resolve) => setImmediate(resolve));
  pending[5]();
  await new Promise((resolve) => setImmediate(resolve));
  pending[6]();
  await fourth;
  assert.equal(active.size, 2);
  assert.ok([...active.values()].some((css) => css.includes('text-shadow: revert')));
  assert.ok(![...active.values()].some((css) => css.includes('#000000')));
});
