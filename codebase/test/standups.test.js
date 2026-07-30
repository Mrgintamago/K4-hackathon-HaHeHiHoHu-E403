import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStandup } from '../src/standups.js';

test('parse daily standup đúng format và không giữ tên/mã học viên', () => {
  const raw = `✅ Stand-up đã ghi nhận
t-203 — <@12345678901234567> đã nộp daily stand-up.
Hôm qua
lên khung project
Hôm nay
build demo topology
Blocker
Không có
Hôm nay lúc 9:08 SA`;
  assert.deepEqual(parseStandup(raw), {
    userId: '12345678901234567', team: 'T203', yesterday: 'lên khung project',
    today: 'build demo topology', blocker: 'Không có',
  });
});

test('bỏ qua hội thoại không phải standup hoặc thiếu trường', () => {
  assert.equal(parseStandup('Hôm nay tôi đang thảo luận bình thường'), null);
  assert.equal(parseStandup('✅ Stand-up đã ghi nhận\nHôm qua\nx'), null);
});
