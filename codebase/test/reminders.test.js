import test from 'node:test';
import assert from 'node:assert/strict';
import { localLessonSummary } from '../src/reminders.js';

test('fallback cục bộ vẫn hiện nội dung bài và bỏ nhãn giảng viên', () => {
  const text = 'AI Product & Project Management · AICB-P1 · Ngày 6 · Quản lý sản phẩm AI như thế nào? · Tên Giảng Viên';
  const summary = localLessonSummary(text);
  assert.match(summary, /AI Product & Project Management/);
  assert.match(summary, /Ngày 6/);
  assert.match(summary, /Quản lý sản phẩm AI như thế nào/);
  assert.doesNotMatch(summary, /Tên Giảng Viên/i);
});
