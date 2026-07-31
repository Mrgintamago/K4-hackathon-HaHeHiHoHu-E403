import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkshopOutput } from '../src/ai.js';

test('chấp nhận citation Workshop tồn tại trong nguồn', () => {
  assert.equal(validateWorkshopOutput('• Ý chính [WS2-190]', '[WS2-190] Nội dung nguồn'), true);
});

test('chặn output thiếu citation hoặc citation không tồn tại', () => {
  const source = '[WS2-190] Nội dung nguồn';
  assert.equal(validateWorkshopOutput('• Ý chính không có citation', source), false);
  assert.equal(validateWorkshopOutput('• Ý chính [WS2-999]', source), false);
});

test('không bắt citation cho nguồn chỉ có lịch hoặc PDF', () => {
  assert.equal(validateWorkshopOutput('• Không có Workshop trong lịch.', 'Lịch chính thức ngày 31.07.2026'), true);
});
