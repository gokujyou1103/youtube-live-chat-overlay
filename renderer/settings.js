const opacitySlider = document.querySelector('#background-opacity');
const opacityValue = document.querySelector('#background-opacity-value');
const fontSlider = document.querySelector('#font-scale');
const fontValue = document.querySelector('#font-scale-value');
const outlinedTextCheckbox = document.querySelector('#outlined-text');
const alwaysOnTopCheckbox = document.querySelector('#always-on-top');
const themeInputs = [...document.querySelectorAll('input[name="theme"]')];

function renderValues() {
  opacityValue.value = `${opacitySlider.value}%`;
  fontValue.value = `${fontSlider.value}%`;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme || 'gray';
}

function selectedTheme() {
  return themeInputs.find((input) => input.checked)?.value || 'gray';
}

async function save() {
  await window.overlay.updateSettings({
    backgroundOpacity: Number(opacitySlider.value),
    fontScale: Number(fontSlider.value),
    outlinedText: outlinedTextCheckbox.checked,
    alwaysOnTop: alwaysOnTopCheckbox.checked,
    theme: selectedTheme()
  });
  await window.overlay.closeSettings();
}

opacitySlider.addEventListener('input', () => {
  renderValues();
  window.overlay.previewBackground(Number(opacitySlider.value), selectedTheme());
});
fontSlider.addEventListener('input', renderValues);
for (const input of themeInputs) {
  input.addEventListener('change', () => {
    applyTheme(input.value);
    window.overlay.previewBackground(Number(opacitySlider.value), input.value);
  });
}
document.querySelector('#apply-settings').addEventListener('click', save);
document.querySelector('#close-settings').addEventListener('click', () => window.overlay.closeSettings());

window.overlay.getSettings().then((settings) => {
  opacitySlider.value = settings.backgroundOpacity;
  fontSlider.value = settings.fontScale;
  outlinedTextCheckbox.checked = settings.outlinedText;
  alwaysOnTopCheckbox.checked = settings.alwaysOnTop;
  const selectedTheme = themeInputs.find((input) => input.value === settings.theme) || themeInputs[0];
  selectedTheme.checked = true;
  applyTheme(selectedTheme.value);
  renderValues();
});
