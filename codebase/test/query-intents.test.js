import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyQuery,
  dateReferenceCount,
  hasAmbiguousDateReference,
  LESSON_PATTERN,
  requestedDate,
  requestedLessonDates,
  requestsAllLessons,
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

test('ngày tuyệt đối không có năm dùng năm hiện tại', () => {
  const date = requestedDate('Tóm tắt bài 30/7', LESSON_PATTERN, new Date('2026-07-31T05:00:00Z'));
  assert.match(date.toISOString(), /^2026-07-30/);
});

test('hôm kia lùi đúng hai ngày và không rơi về hôm nay', () => {
  const now = new Date('2026-07-31T05:00:00Z');
  assert.equal(
    requestedDate('Tóm tắt bài hôm kia', LESSON_PATTERN, now).toISOString(),
    '2026-07-29T05:00:00.000Z',
  );
});

test('hiểu các cách hỏi ngày tương đối phổ biến', () => {
  const now = new Date('2026-07-31T05:00:00Z');
  const cases = [
    ['Tóm tắt bài hôm nay', '2026-07-31'],
    ['Tóm tắt bài hôm qua', '2026-07-30'],
    ['Tóm tắt bài bữa kia', '2026-07-29'],
    ['Tóm tắt bài 2 ngày trước', '2026-07-29'],
    ['Tóm tắt bài ngày mai', '2026-08-01'],
    ['Tóm tắt bài ngày kia', '2026-08-02'],
    ['Tóm tắt bài ngày mốt', '2026-08-02'],
    ['Tóm tắt bài 3 ngày nữa', '2026-08-03'],
  ];
  for (const [question, expected] of cases) {
    assert.equal(requestedDate(question, LESSON_PATTERN, now).toISOString().slice(0, 10), expected);
  }
});

test('câu ghép chọn ngày gần đúng intent bài học và lịch', () => {
  const now = new Date('2026-07-31T05:00:00Z');
  for (const question of [
    'Bài ngày 29/7 và lịch Workshop 31/7 có gì?',
    'Lịch Workshop 31/7 và bài ngày 29/7 có gì?',
  ]) {
    assert.match(requestedDate(question, LESSON_PATTERN, now).toISOString(), /^2026-07-29/);
    assert.match(requestedDate(question, SCHEDULE_PATTERN, now).toISOString(), /^2026-07-31/);
  }
});

test('ngày tuyệt đối không hợp lệ không được rơi về hôm nay', () => {
  assert.equal(
    requestedDate('Tóm tắt bài ngày 31/02/2026', LESSON_PATTERN, new Date('2026-07-31T05:00:00Z')),
    null,
  );
});

test('hiểu câu không dấu và các dạng ngày tuyệt đối phổ biến', () => {
  const now = new Date('2026-07-31T05:00:00Z');
  const cases = [
    ['tom tat bai hom kia', '2026-07-29'],
    ['tom tat bai 2 ngay truoc', '2026-07-29'],
    ['tom tat bai ngay mot', '2026-08-02'],
    ['tóm tắt bài 29/07/26', '2026-07-29'],
    ['tóm tắt bài ngày 29 tháng 7 năm 2026', '2026-07-29'],
    ['tom tat bai ngay 29 thang 7 nam 2026', '2026-07-29'],
  ];
  for (const [question, expected] of cases) {
    assert.equal(requestedDate(question, LESSON_PATTERN, now).toISOString().slice(0, 10), expected);
  }
});

test('nhận diện câu nhiều ngày và mốc ngày mơ hồ để không tự chọn', () => {
  assert.equal(dateReferenceCount('Tóm tắt bài 30/7 và 31/7'), 2);
  assert.equal(dateReferenceCount('Tóm tắt bài hôm kia và hôm qua'), 2);
  assert.equal(hasAmbiguousDateReference('Tóm tắt bài tuần trước'), true);
  assert.equal(hasAmbiguousDateReference('Tóm tắt bài cũ gần nhất'), true);
  assert.equal(hasAmbiguousDateReference('Tóm tắt bài thứ 4'), true);
  assert.equal(hasAmbiguousDateReference('Tóm tắt bài ngày 30/7'), false);
});

test('lập danh sách ngày cho hai bài và tổ hợp bài với Workshop', () => {
  const now = new Date('2026-07-31T05:00:00Z');
  const dates = (question) => requestedLessonDates(question, now)
    .map((date) => date?.toISOString().slice(0, 10));
  assert.deepEqual(dates('Tóm tắt bài hôm qua và hôm nay'), ['2026-07-30', '2026-07-31']);
  assert.deepEqual(dates('Tóm tắt bài 30/7 và 31/7'), ['2026-07-30', '2026-07-31']);
  assert.deepEqual(dates('Tóm tắt WS1 và bài 30/7'), ['2026-07-30']);
  assert.deepEqual(dates('Tóm tắt bài 30/7 và WS1'), ['2026-07-30']);
  assert.deepEqual(dates('Tóm tắt Workshop 31/7 và bài 30/7'), ['2026-07-30']);
  assert.deepEqual(dates('Tóm tắt bài và Workshop hôm qua'), ['2026-07-31']);
  assert.equal(requestsAllLessons('Tóm tắt cả hai bài'), true);
  assert.equal(requestsAllLessons('Tóm tắt 2 bai hoc'), true);
});
