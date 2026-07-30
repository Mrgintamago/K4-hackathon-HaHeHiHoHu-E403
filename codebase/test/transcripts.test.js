import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTS, validateCitations } from '../src/transcripts.js';

test('MVP chỉ khai báo ba transcript Day 2', () => {
  assert.deepEqual(Object.values(PARTS).map((x) => x.file), [
    'transcript-01-clean.md', 'transcript-02-clean.md', 'transcript-03-clean.md',
  ]);
});

test('chặn citation sai file hoặc không tồn tại', () => {
  const part = PARTS['sang-bai-toan'];
  const valid = new Set(['T01-001']);
  assert.equal(validateCitations({ key_points: [{ text: 'Đúng', citations: ['T01-001'] }, { text: 'Đúng nữa', citations: ['T01-001'] }] }, part, valid), true);
  assert.equal(validateCitations({ key_points: [{ text: 'Sai', citations: ['T03-001'] }, { text: 'Sai', citations: ['T01-999'] }] }, part, valid), false);
});

