import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  appendStandupAction,
  buildStandupLogEntry,
  missingStandupCard,
  missingStandupUserIds,
  parseMemberUnits,
  parseStandup,
  statusContent,
} from '../src/standups.js';

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
    userId: '12345678901234567', group: '', team: 'T203', yesterday: 'lên khung project',
    today: 'build demo topology', blocker: 'Không có',
  });
});

test('bỏ qua hội thoại không phải standup hoặc thiếu trường', () => {
  assert.equal(parseStandup('Hôm nay tôi đang thảo luận bình thường'), null);
  assert.equal(parseStandup('✅ Stand-up đã ghi nhận\nHôm qua\nx'), null);
});

test('nhận form Daily có tiêu đề khác nhưng vẫn đủ trường', () => {
  const raw = `Daily Standup đã hoàn thành
T003 — <@12345678901234567> đã nộp daily stand-up.
Hôm qua
hoàn thiện parser
Hôm nay
kiểm thử bot
Blocker
Không có`;
  assert.equal(parseStandup(raw)?.userId, '12345678901234567');
});

test('parse số nhóm G và số team T khi có trong Standup', () => {
  const raw = `✅ Stand-up đã ghi nhận
<@12345678901234567> G-3 T-369
Hôm qua: làm parser
Hôm nay: viết test
Blocker: không có`;
  const parsed = parseStandup(raw);
  assert.equal(parsed.group, 'G3');
  assert.equal(parsed.team, 'T369');
});

test('lấy G/T từ nickname Discord và giữ số 0 đầu team', () => {
  assert.deepEqual(parseMemberUnits('G10 - T003-Lưu Ng Ngọc Hân-01386'), {
    group: 'G10',
    team: 'T003',
  });
});

test('chọn blocker cập nhật cả trạng thái và mục Blocker cuối card', () => {
  const card = `🧪 **DEMO STANDUP · G-CHƯA-CẤU-HÌNH → T369**
**Hôm nay**
build demo
        ☐ Chưa xác nhận
        ↓
**Ngày mai**
Loading...

🚧 **Blocker:** Không có`;
  const updated = statusContent(card, 'blocked', 'Tôi bị ăn hiếp', 'G10', 'T003');
  assert.match(updated, /DEMO STANDUP · G-10 → T-003/);
  assert.match(updated, /🧱 Có blocker: Tôi bị ăn hiếp/);
  assert.match(updated, /🚧 \*\*Blocker:\*\* Tôi bị ăn hiếp/);
  assert.doesNotMatch(updated, /Blocker:\*\* Không có/);
});

test('xác định user chưa nộp Standup trong ngày', () => {
  const users = new Map([
    ['11111111111111111', '21111111111111111'],
    ['12222222222222222', '22222222222222222'],
  ]);
  const missing = missingStandupUserIds(users, new Set(['11111111111111111']));
  assert.deepEqual(missing, ['12222222222222222']);
});

test('card chưa làm Standup hiển thị ngày, group và team', () => {
  const content = missingStandupCard({
    userId: '12345678901234567',
    group: 'G10',
    team: 'T003',
    date: '2026-07-31',
  });
  assert.match(content, /G-10 → T-003/);
  assert.match(content, /Chưa ghi nhận Daily Standup ngày 2026-07-31/);
  assert.match(content, /Hôm qua · Hôm nay · Blocker/);
});

test('ghi log phân cấp G -> T -> user và che PII trong blocker', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'standup-log-test-'));
  const file = path.join(directory, 'actions.json');
  try {
    const entry = buildStandupLogEntry({
      group: 'G3',
      team: 'T369',
      userId: '12345678901234567',
      userName: 'Nguyễn Văn A',
      status: 'blocked',
      blocker: 'Chờ phản hồi từ demo@example.com',
      standupDate: '2026-07-31',
      timestamp: '2026-07-31T04:00:00.000Z',
    });
    await appendStandupAction(entry, file);
    const log = JSON.parse(fs.readFileSync(file, 'utf8'));
    const user = log.groups['G-3'].teams['T-369'].users['12345678901234567'];
    assert.equal(user.name, 'Nguyễn Văn A');
    assert.equal(user.history[0].status, 'blocked');
    assert.equal(user.history[0].standupDate, '2026-07-31');
    assert.doesNotMatch(user.history[0].blocker, /demo@example\.com/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
