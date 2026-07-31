import { DEFAULTS } from '../shared/constants.js';
import { getSettings, saveSettings } from '../shared/storage.js';
import { safeUrl } from '../shared/validation.js';

const form = document.querySelector('#form');
const message = document.querySelector('#message');

function fill(settings) {
  for (const [key, value] of Object.entries(settings)) {
    const field = form.elements.namedItem(key);
    if (!field) continue;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = Array.isArray(value) ? value.join('\n') : value;
  }
  document.querySelector('#pet-size').textContent = `${settings.petSize}px`;
}

form.petSize?.addEventListener('input', () => { document.querySelector('#pet-size').textContent = `${form.petSize.value}px`; });
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const allowLanHost = form.allowLanHost.checked;
  const endpoints = ['websocketUrl', 'pollingUrl', 'healthUrl'];
  const settings = { ...await getSettings() };
  for (const key of endpoints) {
    const value = safeUrl(data.get(key), { localOnly: true, allowLan: allowLanHost });
    if (!value) {
      message.textContent = `${key} không hợp lệ hoặc không phải localhost.`;
      return;
    }
    settings[key] = value;
  }
  for (const key of ['nativeNotifications', 'speechBubbles', 'sounds', 'petVisible', 'animationsPaused', 'urgentSticky', 'confirmExternalUrls', 'allowLanHost', 'debug']) {
    settings[key] = form[key].checked;
  }
  Object.assign(settings, {
    authToken: String(data.get('authToken') || '').slice(0, 200),
    pollingIntervalMinutes: Math.max(0.5, Math.min(60, Number(data.get('pollingIntervalMinutes')) || 1)),
    petSize: Math.max(48, Math.min(128, Number(data.get('petSize')) || 72)),
    animationSpeed: Math.max(0.25, Math.min(2, Number(data.get('animationSpeed')) || 1)),
    soundVolume: Math.max(0, Math.min(1, Number(data.get('soundVolume')) || 0)),
    autoDismissSeconds: Math.max(3, Math.min(120, Number(data.get('autoDismissSeconds')) || 8)),
    disabledSites: String(data.get('disabledSites') || '').split(/\s+/).map((x) => x.toLowerCase()).filter((x) => /^[a-z0-9.-]+$/.test(x)),
  });
  await saveSettings(settings);
  message.textContent = 'Đã lưu. Reload trang đang mở để áp dụng giao diện.';
});
document.querySelector('#reset').onclick = async () => {
  if (!confirm('Reset toàn bộ cài đặt Pixel Pet?')) return;
  await saveSettings(DEFAULTS);
  fill(DEFAULTS);
  message.textContent = 'Đã reset.';
};
fill(await getSettings());
