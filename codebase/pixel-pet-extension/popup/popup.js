import { MESSAGE } from '../shared/constants.js';
import { saveSettings } from '../shared/storage.js';

const $ = (selector) => document.querySelector(selector);
let state;

function render() {
  const { status, history, settings } = state;
  $('#status-dot').classList.toggle('online', status.connected);
  $('#connection-label').textContent = status.connected ? `Đã kết nối · ${status.mode}` : 'Mất kết nối';
  $('#endpoint').textContent = settings.websocketUrl;
  $('#unread-count').textContent = history.filter((item) => !item.read).length;
  $('#history').replaceChildren(...history.slice(0, 5).map((item) => {
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = item.title;
    const p = document.createElement('p');
    p.textContent = item.message;
    li.append(strong, p);
    return li;
  }));
  for (const [id, key] of [['native', 'nativeNotifications'], ['bubbles', 'speechBubbles'], ['sounds', 'sounds'], ['visible', 'petVisible']]) {
    $(`#${id}`).checked = settings[key];
    $(`#${id}`).onchange = async (event) => {
      state.settings[key] = event.target.checked;
      await saveSettings(state.settings);
    };
  }
}

async function load() {
  state = await chrome.runtime.sendMessage({ type: MESSAGE.getState });
  render();
}
$('#reconnect').onclick = async () => { await chrome.runtime.sendMessage({ type: MESSAGE.reconnect }); await load(); };
$('#mark-read').onclick = async () => { await chrome.runtime.sendMessage({ type: MESSAGE.markAllRead }); await load(); };
$('#settings').onclick = () => chrome.runtime.openOptionsPage();
chrome.runtime.onMessage.addListener((message) => { if (message.type === MESSAGE.status) load(); });
load();
