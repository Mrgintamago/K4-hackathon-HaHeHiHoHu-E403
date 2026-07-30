import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findLessonPdf } from '../src/lessons.js';

test('chỉ tìm PDF theo dd.mm.yyyy-ngaythucuabaihoc.pdf', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lesson-pdf-test-'));
  try {
    fs.writeFileSync(path.join(directory, '30.07.2026-thu-nam.pdf'), 'fixture');
    fs.writeFileSync(path.join(directory, 'ngay 30.pdf'), 'fixture');
    assert.equal(path.basename(findLessonPdf(directory, new Date('2026-07-30T05:00:00Z'), 'Asia/Ho_Chi_Minh')), '30.07.2026-thu-nam.pdf');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('không đoán khi có nhiều PDF cho cùng một ngày', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lesson-pdf-test-'));
  try {
    fs.writeFileSync(path.join(directory, '30.07.2026-thu-nam.pdf'), 'fixture');
    fs.writeFileSync(path.join(directory, '30.07.2026-bai-khac.pdf'), 'fixture');
    assert.equal(findLessonPdf(directory, new Date('2026-07-30T05:00:00Z'), 'Asia/Ho_Chi_Minh'), null);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
