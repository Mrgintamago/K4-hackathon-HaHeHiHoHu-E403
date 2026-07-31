import test from 'node:test';
import assert from 'node:assert/strict';
import { localLessonSummary } from '../src/reminders.js';

test('fallback cục bộ vẫn hiện nội dung bài và bỏ nhãn giảng viên', () => {
  const text = `[Trang 1] AI Product & Project Management · AICB-P1 · Ngày 6 · Quản lý sản phẩm AI như thế nào? Tên Giảng Viên VinUniversity · Phase 1
[Trang 2] Team đã build nhưng stakeholder muốn đổi requirements. Làm sao xử lý?
[Trang 3] Nội Dung Bài Học 1. Agile/Scrum 2. MVP first 3. ROI analysis Giảng viên VinUni`;
  const summary = localLessonSummary(text);
  assert.match(summary, /AI Product & Project Management/);
  assert.match(summary, /Ngày 6/);
  assert.match(summary, /Quản lý sản phẩm AI như thế nào/);
  assert.match(summary, /stakeholder muốn đổi requirements/);
  assert.match(summary, /Agile\/Scrum/);
  assert.match(summary, /ROI analysis/);
  assert.doesNotMatch(summary, /Tên Giảng Viên/i);
});
