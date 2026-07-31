import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findLessonPdf, lessonLinkForPdf, lessonNumberForPdf } from '../src/lessons.js';

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

test('tra link bài học theo phần đuôi tên file trong list.md', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lesson-link-test-'));
  try {
    const pdf = path.join(directory, '31.07.2026-ngay6.pdf');
    const list = path.join(directory, 'list.md');
    fs.writeFileSync(pdf, 'fixture');
    fs.writeFileSync(list, 'ngay5: https://vlearn.dev/day5\nngay6: https://vlearn.dev/day6\n');
    assert.equal(lessonLinkForPdf(pdf, list), 'https://vlearn.dev/day6');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('không trả link nếu list không có khóa tương ứng', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lesson-link-test-'));
  try {
    const pdf = path.join(directory, '31.07.2026-ngay6.pdf');
    const list = path.join(directory, 'list.md');
    fs.writeFileSync(pdf, 'fixture');
    fs.writeFileSync(list, 'ngay5: https://vlearn.dev/day5\n');
    assert.equal(lessonLinkForPdf(pdf, list), '');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('chuyển đuôi nội bộ ngay5 thành nhãn Ngày 5', () => {
  assert.equal(lessonNumberForPdf('C:\\data\\30.07.2026-ngay5.pdf'), 5);
  assert.equal(lessonNumberForPdf('/data/31.07.2026-ngay06.pdf'), 6);
  assert.equal(lessonNumberForPdf('/data/31.07.2026-chu-de-ai.pdf'), null);
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
