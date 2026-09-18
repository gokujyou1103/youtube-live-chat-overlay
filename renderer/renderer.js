const form = document.querySelector('#url-form');
const urlInput = document.querySelector('#chat-url');
const errorOutput = document.querySelector('#error');
const clickThroughButton = document.querySelector('#click-through');
const backButton = document.querySelector('#back');
let activeResizeHandle;
let pendingResizePoint;
let resizeFrame;

function renderClickThrough(enabled) {
  clickThroughButton.textContent = `マウス透過: ${enabled ? 'ON' : 'OFF'}`;
  document.body.classList.toggle('click-through-enabled', enabled);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme || 'gray';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorOutput.textContent = '';
  try {
    await window.overlay.loadChat(urlInput.value.trim());
  } catch (error) {
    errorOutput.textContent = error.message;
  }
});

clickThroughButton.addEventListener('click', async () => {
  renderClickThrough(await window.overlay.toggleClickThrough());
});

document.querySelector('#settings').addEventListener('click', () => window.overlay.openSettings());
backButton.addEventListener('click', () => window.overlay.showLauncher());
document.querySelector('#minimize').addEventListener('click', () => window.overlay.toggleCollapsed());
document.querySelector('#close').addEventListener('click', () => window.overlay.close());

for (const handle of document.querySelectorAll('[data-resize]')) {
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    activeResizeHandle = handle;
    handle.setPointerCapture(event.pointerId);
    window.overlay.startResize(handle.dataset.resize, { x: event.screenX, y: event.screenY });
    event.preventDefault();
  });
}

document.addEventListener('pointermove', (event) => {
  if (!activeResizeHandle) return;
  pendingResizePoint = { x: event.screenX, y: event.screenY };
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => {
    window.overlay.moveResize(pendingResizePoint);
    resizeFrame = undefined;
  });
});

function endResize() {
  if (!activeResizeHandle) return;
  activeResizeHandle = undefined;
  cancelAnimationFrame(resizeFrame);
  resizeFrame = undefined;
  if (pendingResizePoint) window.overlay.moveResize(pendingResizePoint);
  pendingResizePoint = undefined;
  window.overlay.endResize();
}
document.addEventListener('pointerup', endResize);
document.addEventListener('pointercancel', endResize);
document.addEventListener('lostpointercapture', endResize);

window.overlay.getClickThrough().then(renderClickThrough);
window.overlay.getSettings().then((settings) => applyTheme(settings.theme));
window.overlay.onClickThroughChanged(renderClickThrough);
window.overlay.onThemeChanged(applyTheme);
window.overlay.onChatVisibilityChanged((visible) => {
  document.body.classList.toggle('chat-active', visible);
  backButton.disabled = !visible;
});
window.overlay.onCollapsedChanged((collapsed) => {
  document.documentElement.classList.toggle('window-collapsed', collapsed);
  document.body.classList.toggle('window-collapsed', collapsed);
});
urlInput.focus();
