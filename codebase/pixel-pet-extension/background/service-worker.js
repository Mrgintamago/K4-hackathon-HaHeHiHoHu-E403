import { KEYS, MESSAGE } from '../shared/constants.js';
import { getHistory, getSeenIds, getSettings, getStatus, saveHistory, saveSeenIds, saveStatus } from '../shared/storage.js';
import { reconnectDelay, safeUrl, validateNotification } from '../shared/validation.js';
import { rememberId } from '../shared/queue.js';

let socket = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
const nativeActions = new Map();

function nativeSafeAction(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? url.toString() : '';
  } catch {
    return '';
  }
}

async function setStatus(connected, mode, detail = '') {
  const status = { connected, mode, detail, updatedAt: new Date().toISOString() };
  await saveStatus(status);
  chrome.runtime.sendMessage({ type: MESSAGE.status, status }).catch(() => {});
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) if (tab.id) chrome.tabs.sendMessage(tab.id, { type: MESSAGE.status, status }).catch(() => {});
}

function socketUrl(settings) {
  const url = new URL(settings.websocketUrl);
  if (settings.authToken) url.searchParams.set('token', settings.authToken);
  return url.toString();
}

async function acceptNotification(raw) {
  const item = validateNotification(raw);
  if (!item) return false;
  const seen = await getSeenIds();
  if (!rememberId(seen, item.id)) return false;
  await saveSeenIds(seen);
  const history = await getHistory();
  await saveHistory([item, ...history.filter((entry) => entry.id !== item.id)]);
  const settings = await getSettings();
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) if (tab.id) chrome.tabs.sendMessage(tab.id, { type: MESSAGE.notification, notification: item }).catch(() => {});
  if (settings.nativeNotifications) {
    const nativeAction = nativeSafeAction(item.actionUrl);
    if (nativeAction) nativeActions.set(item.id, nativeAction);
    await chrome.notifications.create(item.id, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/pet.svg'),
      title: item.title,
      message: item.message,
      priority: ['high', 'urgent'].includes(item.priority) ? 2 : 0,
      buttons: nativeAction ? [{ title: item.actionLabel || 'Mở' }] : [],
    });
  }
  return true;
}

async function connect() {
  clearTimeout(reconnectTimer);
  const settings = await getSettings();
  const endpoint = safeUrl(settings.websocketUrl, { localOnly: true, allowLan: settings.allowLanHost });
  if (!endpoint) return setStatus(false, 'offline', 'WebSocket URL không hợp lệ');
  try { socket?.close(); } catch { /* already closed */ }
  socket = new WebSocket(socketUrl(settings));
  socket.onopen = () => {
    reconnectAttempt = 0;
    setStatus(true, 'websocket');
  };
  socket.onmessage = (event) => {
    if (event.data === 'pong') return;
    try {
      const payload = JSON.parse(event.data);
      if (payload.kind !== 'hello') acceptNotification(payload);
    } catch { /* malformed messages are ignored */ }
  };
  socket.onerror = () => socket?.close();
  socket.onclose = () => {
    setStatus(false, 'polling', 'WebSocket mất kết nối');
    reconnectTimer = setTimeout(connect, reconnectDelay(reconnectAttempt++));
  };
}

async function poll() {
  const settings = await getSettings();
  const endpoint = safeUrl(settings.pollingUrl, { localOnly: true, allowLan: settings.allowLanHost });
  if (!endpoint) return;
  try {
    const response = await fetch(endpoint, {
      headers: settings.authToken ? { 'X-Pixel-Pet-Token': settings.authToken } : {},
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const items = await response.json();
    if (Array.isArray(items)) for (const item of items) await acceptNotification(item);
    if (socket?.readyState !== WebSocket.OPEN) await setStatus(true, 'polling');
  } catch {
    if (socket?.readyState !== WebSocket.OPEN) await setStatus(false, 'offline', 'Local server chưa chạy');
  }
}

async function scheduleAlarm() {
  const settings = await getSettings();
  await chrome.alarms.clear('pixel-pet-health');
  chrome.alarms.create('pixel-pet-health', { periodInMinutes: Math.max(0.5, Number(settings.pollingIntervalMinutes) || 1) });
}

chrome.runtime.onInstalled.addListener(() => { scheduleAlarm(); connect(); poll(); });
chrome.runtime.onStartup.addListener(() => { scheduleAlarm(); connect(); poll(); });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pixel-pet-health') {
    poll();
    if (!socket || socket.readyState > WebSocket.OPEN) connect();
  }
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes[KEYS.settings]) { scheduleAlarm(); connect(); }
});
chrome.notifications.onClicked.addListener((id) => {
  (async () => {
    const item = (await getHistory()).find((entry) => entry.id === id);
    const url = nativeActions.get(id) || nativeSafeAction(item?.actionUrl);
    if (url) chrome.tabs.create({ url });
  })();
});
chrome.notifications.onButtonClicked.addListener((id) => {
  (async () => {
    const item = (await getHistory()).find((entry) => entry.id === id);
    const url = nativeActions.get(id) || nativeSafeAction(item?.actionUrl);
    if (url) chrome.tabs.create({ url });
  })();
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === MESSAGE.getState) {
      const history = await getHistory();
      sendResponse({ status: await getStatus(), history, settings: await getSettings() });
    } else if (message.type === MESSAGE.reconnect) {
      await connect(); await poll(); sendResponse({ ok: true });
    } else if (message.type === MESSAGE.markAllRead) {
      const history = (await getHistory()).map((item) => ({ ...item, read: true }));
      await saveHistory(history); sendResponse({ ok: true });
    } else if (message.type === MESSAGE.openAction) {
      const url = safeUrl(message.url);
      if (url && /^https?:/.test(url)) await chrome.tabs.create({ url });
      sendResponse({ ok: Boolean(url) });
    }
  })();
  return true;
});

scheduleAlarm();
connect();
poll();
