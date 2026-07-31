import { PRIORITIES, TYPES } from './constants.js';

export function safeUrl(value, { localOnly = false, allowLan = false } = {}) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) return '';
    const host = url.hostname.toLowerCase();
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(host);
    const lan = host.endsWith('.local')
      || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
      || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)
      || (() => {
        const match = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
        return match && Number(match[1]) >= 16 && Number(match[1]) <= 31;
      })();
    if (localOnly && !local && !(allowLan && lan)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export function validateNotification(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const id = typeof input.id === 'string' && /^[A-Za-z0-9._:-]{1,100}$/.test(input.id) ? input.id : '';
  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 80) : '';
  const message = typeof input.message === 'string' ? input.message.trim().slice(0, 500) : '';
  const type = TYPES.includes(input.type) ? input.type : '';
  const priority = PRIORITIES.includes(input.priority) ? input.priority : '';
  const timestamp = new Date(input.timestamp);
  if (!id || !title || !message || !type || !priority || Number.isNaN(timestamp.getTime())) return null;
  const actionUrl = safeUrl(input.actionUrl);
  return {
    id, title, message, type, priority,
    timestamp: timestamp.toISOString(),
    actionUrl: actionUrl && /^https?:/.test(actionUrl) ? actionUrl : '',
    actionLabel: typeof input.actionLabel === 'string' ? input.actionLabel.trim().slice(0, 40) : '',
    read: false,
  };
}

export function reconnectDelay(attempt, random = Math.random()) {
  return Math.min(60_000, 1_000 * (2 ** Math.min(Math.max(0, attempt), 6))) + Math.floor(random * 500);
}

export function dismissDelay(notification, settings) {
  if (['high', 'urgent'].includes(notification.priority) && settings.urgentSticky) return 0;
  return Math.max(3, Number(settings.autoDismissSeconds) || 8) * 1000;
}
