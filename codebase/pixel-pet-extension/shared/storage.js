import { DEFAULTS, KEYS } from './constants.js';

const area = () => chrome.storage.local;
export async function getSettings() {
  const data = await area().get(KEYS.settings);
  return { ...DEFAULTS, ...(data[KEYS.settings] || {}) };
}
export async function saveSettings(settings) {
  await area().set({ [KEYS.settings]: { ...DEFAULTS, ...settings } });
}
export async function getHistory() {
  const data = await area().get(KEYS.history);
  return Array.isArray(data[KEYS.history]) ? data[KEYS.history] : [];
}
export async function saveHistory(history) {
  await area().set({ [KEYS.history]: history.slice(0, 100) });
}
export async function getSeenIds() {
  const data = await area().get(KEYS.seenIds);
  return new Set(Array.isArray(data[KEYS.seenIds]) ? data[KEYS.seenIds] : []);
}
export async function saveSeenIds(ids) {
  await area().set({ [KEYS.seenIds]: [...ids].slice(-500) });
}
export async function getStatus() {
  const data = await area().get(KEYS.status);
  return data[KEYS.status] || { connected: false, mode: 'offline', updatedAt: new Date().toISOString() };
}
export async function saveStatus(status) {
  await area().set({ [KEYS.status]: status });
}
