import test from 'node:test';
import assert from 'node:assert/strict';
import { BoundedQueue, rememberId } from '../pixel-pet-extension/shared/queue.js';
import {
  dismissDelay,
  reconnectDelay,
  safeUrl,
  validateNotification,
} from '../pixel-pet-extension/shared/validation.js';

const valid = {
  id: 'notif-001',
  title: 'Study reminder',
  message: 'Workshop starts soon.',
  type: 'reminder',
  priority: 'high',
  timestamp: '2026-07-31T14:30:00+07:00',
  actionUrl: 'http://localhost:3000/schedule',
};

test('Pixel Pet chấp nhận payload hợp lệ và loại trường thừa', () => {
  const result = validateNotification({ ...valid, html: '<script>alert(1)</script>' });
  assert.equal(result.id, 'notif-001');
  assert.equal(result.actionUrl, 'http://localhost:3000/schedule');
  assert.equal('html' in result, false);
});

test('Pixel Pet từ chối payload sai và URL nguy hiểm', () => {
  assert.equal(validateNotification({ ...valid, id: '' }), null);
  assert.equal(validateNotification({ ...valid, type: 'unknown' }), null);
  assert.equal(validateNotification({ ...valid, actionUrl: 'javascript:alert(1)' }).actionUrl, '');
});

test('endpoint mặc định chỉ nhận localhost', () => {
  assert.equal(safeUrl('ws://localhost:8765/ws', { localOnly: true }), 'ws://localhost:8765/ws');
  assert.equal(safeUrl('http://evil.example/api', { localOnly: true }), '');
  assert.equal(safeUrl('http://evil.example/api', { localOnly: true, allowLan: true }), '');
  assert.equal(safeUrl('http://192.168.1.4:8765/api', { localOnly: true, allowLan: true }), 'http://192.168.1.4:8765/api');
});

test('queue có giới hạn và giữ thông báo mới nhất', () => {
  const queue = new BoundedQueue(2);
  queue.push('a'); queue.push('b'); queue.push('c');
  assert.equal(queue.length, 2);
  assert.equal(queue.shift(), 'b');
});

test('duplicate detection chỉ nhận ID một lần và giới hạn bộ nhớ', () => {
  const ids = new Set();
  assert.equal(rememberId(ids, 'a', 2), true);
  assert.equal(rememberId(ids, 'a', 2), false);
  rememberId(ids, 'b', 2);
  rememberId(ids, 'c', 2);
  assert.deepEqual([...ids], ['b', 'c']);
});

test('backoff tăng theo cấp số nhân và có trần', () => {
  assert.equal(reconnectDelay(0, 0), 1000);
  assert.equal(reconnectDelay(3, 0), 8000);
  assert.equal(reconnectDelay(99, 0), 60000);
});

test('high priority sticky còn low priority tự đóng', () => {
  assert.equal(dismissDelay(valid, { urgentSticky: true, autoDismissSeconds: 8 }), 0);
  assert.equal(dismissDelay({ ...valid, priority: 'low' }, { urgentSticky: true, autoDismissSeconds: 8 }), 8000);
});

test('storage helper lưu và đọc settings qua chrome.storage.local', async () => {
  const memory = {};
  globalThis.chrome = {
    storage: {
      local: {
        async get(key) { return { [key]: memory[key] }; },
        async set(values) { Object.assign(memory, values); },
      },
    },
  };
  const { getSettings, saveSettings } = await import('../pixel-pet-extension/shared/storage.js');
  await saveSettings({ petSize: 96, speechBubbles: false });
  const settings = await getSettings();
  assert.equal(settings.petSize, 96);
  assert.equal(settings.speechBubbles, false);
  delete globalThis.chrome;
});
