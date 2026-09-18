const fs = require('node:fs');
const path = require('node:path');
const DEFAULT_SETTINGS = Object.freeze({
  backgroundOpacity: 0,
  fontScale: 100,
  outlinedText: false,
  alwaysOnTop: true,
  theme: 'gray'
});
const THEME_COLORS = {
  gray: [45, 45, 48],
  white: [255, 255, 255],
  pink: [244, 184, 202],
  blue: [166, 218, 244],
  green: [177, 226, 187]
};

function normalizeSettings(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  const bounded = (value, fallback, min, max) =>
    Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  return {
    backgroundOpacity: bounded(value.backgroundOpacity, 0, 0, 100),
    fontScale: bounded(value.fontScale, 100, 50, 200),
    outlinedText: Boolean(value.outlinedText),
    alwaysOnTop: value.alwaysOnTop === undefined ? true : Boolean(value.alwaysOnTop),
    theme: Object.hasOwn(THEME_COLORS, value.theme) ? value.theme : 'gray'
  };
}

function backgroundColor(settings, extraOpacity = 0) {
  const rgb = THEME_COLORS[settings.theme] || THEME_COLORS.gray;
  return `rgba(${rgb.join(', ')}, ${Math.min(100, settings.backgroundOpacity + extraOpacity) / 100})`;
}

class SettingsStore {
  constructor(filename) {
    this.filename = filename;
    try { this.value = normalizeSettings(JSON.parse(fs.readFileSync(filename, 'utf8'))); }
    catch (error) {
      if (error.code !== 'ENOENT') console.warn('Settings could not be loaded:', error.message);
      this.value = { ...DEFAULT_SETTINGS };
    }
  }
  commit(value) {
    const normalized = normalizeSettings(value);
    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    fs.writeFileSync(this.filename, JSON.stringify(normalized, null, 2), 'utf8');
    this.value = normalized;
    return { ...normalized };
  }
}
module.exports = { DEFAULT_SETTINGS, normalizeSettings, backgroundColor, SettingsStore };
