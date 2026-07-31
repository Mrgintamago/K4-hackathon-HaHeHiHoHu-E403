import test from 'node:test';
import assert from 'node:assert/strict';
import { extractEvents } from '../src/announcements.js';

test('trích lịch ngày tuyệt đối', () => {
  const events = extractEvents('WORKSHOP 3\nThời gian: 20:00 ngày 30/07/2026\nNội dung: MVP', new Date('2026-07-27'));
  assert.equal(events[0].dateKey, '30.07.2026');
  assert.equal(events[0].type, 'Workshop');
  assert.equal(events[0].workshopNumber, 3);
});

test('ưu tiên giờ có nhãn Thời gian thay vì timestamp đầu message', () => {
  const source = '[7/30/2026 3:50 PM] manager\nWORKSHOP 3\nThời gian: 20:00 ngày 30/07/2026';
  const events = extractEvents(source, new Date('2026-07-30'));
  assert.equal(events.find((event) => event.dateKey === '30.07.2026')?.time, '20:00');
});

test('trích từng lịch theo thứ trong thông báo tuần', () => {
  const source = 'Thứ 4 | 20:00\nMentor Duty\nNội dung: rà soát tiến độ\nThứ 5 | 20:00\nWorkshop 3\nNội dung: thiết kế MVP';
  const events = extractEvents(source, new Date('2026-07-27T09:00:00'));
  assert.deepEqual(events.map((event) => [event.dateKey, event.type]), [
    ['29.07.2026', 'Mentor duty'], ['30.07.2026', 'Workshop'],
  ]);
  assert.equal(events[1].workshopNumber, 3);
});
