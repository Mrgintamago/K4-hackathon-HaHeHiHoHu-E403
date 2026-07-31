import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyQuery,
  LESSON_PATTERN,
  requestedDate,
  SCHEDULE_PATTERN,
} from '../src/query-intents.js';

test('nhận diện đồng thời câu hỏi bài học và lịch Workshop', () => {
  assert.deepEqual(classifyQuery('Hôm qua học bài nào, hôm nay có lịch workshop không?'), {
    asksLesson: true,
    asksSchedule: true,
    asksWeeklySchedule: false,
  });
});

test('nhận diện câu hỏi lịch hàng tuần', () => {
  assert.deepEqual(classifyQuery('Các buổi tối hàng tuần sẽ có những lịch gì?'), {
    asksLesson: false,
    asksSchedule: true,
    asksWeeklySchedule: true,
  });
});

test('tách ngày riêng cho bài học và lịch trong câu ghép', () => {
  const now = new Date('2026-07-31T05:00:00Z');
  const question = 'Hôm qua học bài nào, hôm nay có lịch workshop không?';
  assert.equal(requestedDate(question, LESSON_PATTERN, now).toISOString(), '2026-07-30T05:00:00.000Z');
  assert.equal(requestedDate(question, SCHEDULE_PATTERN, now).toISOString(), '2026-07-31T05:00:00.000Z');
});

test('ngày tuyệt đối được ưu tiên', () => {
  const date = requestedDate('Ngày 30.07.2026 học bài nào?', LESSON_PATTERN, new Date('2026-07-31'));
  assert.match(date.toISOString(), /^2026-07-30/);
});
