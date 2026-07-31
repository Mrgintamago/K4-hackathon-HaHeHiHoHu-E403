import test from 'node:test';
import assert from 'node:assert/strict';
import { reminderDestinationChannelIds } from '../src/reminders.js';

test('ưu tiên channel thông báo chung cho daily reminder', () => {
  const personal = new Map([
    ['111111111111111111', '333333333333333333'],
  ]);
  assert.deepEqual(
    [...reminderDestinationChannelIds('222222222222222222', personal)],
    ['222222222222222222'],
  );
});

test('chỉ dùng channel cá nhân khi chưa cấu hình channel chung', () => {
  const personal = new Map([
    ['111111111111111111', '333333333333333333'],
  ]);
  assert.deepEqual(
    [...reminderDestinationChannelIds('', personal)],
    ['333333333333333333'],
  );
});
