import test from 'node:test';
import assert from 'node:assert/strict';
import { redactPii, safeQuestion } from '../src/privacy.js';

test('che PII trước khi đưa nội dung vào prompt', () => {
  const result = redactPii('mail a@example.com, số 0912345678, <@12345678901234567>');
  assert.doesNotMatch(result, /example|0912345678|12345678901234567/);
});

test('bỏ mention bot và giới hạn độ dài câu hỏi', () => {
  assert.equal(safeQuestion('<@12345678901234567> tóm tắt bài', '12345678901234567'), 'tóm tắt bài');
  assert.equal(safeQuestion('a'.repeat(1100), '12345678901234567').length, 1000);
});
