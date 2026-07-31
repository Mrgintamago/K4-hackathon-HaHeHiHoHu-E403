import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLocalWorkshopFallback,
  buildWorkshopSummarySource,
  findWorkshopQaSource,
  isWorkshopQuery,
  loadWorkshop,
  parseWorkshopText,
  workshopNumbersForContent,
  workshopNumbersFromText,
} from '../src/workshops.js';

test('parse được marker thường, marker bold và chấp nhận mã lặp', () => {
  const chunks = parseWorkshopText(
    '[WS1-001] Mở đầu\n**[WS1-002]** Nội dung\n[WS1-001] Phần tiếp theo',
    'WS1',
  );
  assert.deepEqual(chunks.map(({ code }) => code), ['WS1-001', 'WS1-002', 'WS1-001']);
  assert.equal(chunks[2].text, 'Phần tiếp theo');
});

test('nhận diện số workshop từ câu hỏi hoặc thông báo', () => {
  assert.deepEqual(workshopNumbersFromText('Workshop 02 bắt đầu lúc 20:00'), [2]);
  assert.deepEqual(workshopNumbersFromText('tóm tắt WS1 và workshop 2'), [1, 2]);
  assert.deepEqual(workshopNumbersFromText('tóm tắt w s 2'), [2]);
  assert.deepEqual(workshopNumbersFromText('nội dung w.s-1'), [1]);
  assert.equal(isWorkshopQuery('WS2 có câu hỏi nào về FinTech?'), true);
  assert.equal(isWorkshopQuery('ws 1 nói về gì?'), true);
  assert.equal(isWorkshopQuery('tóm tắt w s 2'), true);
  assert.equal(isWorkshopQuery('bài PDF hôm nay'), false);
});

test('tóm tắt WS không ghi số vẫn nạp transcript phù hợp', () => {
  assert.deepEqual(workshopNumbersForContent('tóm tắt WS1', [2]), [1]);
  assert.deepEqual(workshopNumbersForContent('tóm tắt WS', [2]), [2]);
  assert.deepEqual(workshopNumbersForContent('tóm tắt của ws'), [1, 2]);
  assert.deepEqual(workshopNumbersForContent('tóm tắt Workshop hôm kia'), []);
  assert.deepEqual(workshopNumbersForContent('tóm tắt Workshop hôm kia', [2]), [2]);
});

test('load hai transcript thật và tách vùng nội dung/hỏi đáp', () => {
  for (const number of [1, 2]) {
    const workshop = loadWorkshop(number);
    assert.ok(workshop.contentChunks.length > 10);
    assert.ok(workshop.qaChunks.length > 3);
    assert.ok(workshop.chunks.every((chunk) => chunk.code.startsWith(`WS${number}-`)));
  }
});

test('nguồn daily có nội dung chính, câu hỏi cuối buổi và đã che PII', () => {
  const workshop = {
    contentChunks: [
      { code: 'WS1-001', text: 'Liên hệ demo@example.com hoặc 0901234567' },
      { code: 'WS1-002', text: 'Nội dung chính của workshop' },
    ],
    qaChunks: [
      { code: 'WS1-100', text: 'Em muốn hỏi <@123456789012345678> về sản phẩm không ạ?' },
    ],
  };
  const source = buildWorkshopSummarySource(workshop);
  assert.match(source, /CÂU_HỎI_CUỐI_BUỔI/);
  assert.doesNotMatch(source, /demo@example\.com|0901234567|123456789012345678/);
  assert.match(source, /\[email đã ẩn\]|\[số điện thoại đã ẩn\]/);
});

test('nguồn tóm tắt lấy nội dung xuyên suốt đoạn dài và kèm câu trả lời Q&A', () => {
  const workshop = {
    contentChunks: [{
      code: 'WS1-010',
      text: [
        `Mở đầu ${'giới thiệu '.repeat(70)}`,
        `Kiến thức giữa buổi ${'xác thực giả thuyết '.repeat(70)}`,
        `Chủ đề cuối ${'đo lường kết quả '.repeat(70)}`,
      ].join(' '),
    }],
    qaChunks: [
      { code: 'WS1-090', text: 'Em muốn hỏi cách kiểm tra nhu cầu người dùng không ạ?' },
      { code: 'WS1-091', text: 'Giảng viên trả lời rằng nên phỏng vấn và thử nghiệm trước.' },
      { code: 'WS1-092', text: 'Sau đó so sánh kết quả với tiêu chí đã đặt ra.' },
    ],
  };
  const source = buildWorkshopSummarySource(workshop, 12000);
  assert.match(source, /Kiến thức giữa buổi/);
  assert.match(source, /Chủ đề cuối/);
  assert.match(source, /WS1-090.*kiểm tra nhu cầu/);
  assert.match(source, /WS1-091.*phỏng vấn/);
});

test('fallback tóm tắt Workshop có citation và che PII', () => {
  const workshop = {
    label: 'Workshop 1',
    contentChunks: [
      { code: 'WS1-001', text: 'Mở đầu và giới thiệu mục tiêu workshop.' },
      { code: 'WS1-002', text: 'Xác định vấn đề người dùng trước khi xây sản phẩm.' },
      { code: 'WS1-003', text: 'Liên hệ demo@example.com để lấy dữ liệu riêng.' },
      { code: 'WS1-004', text: 'Thử nghiệm giải pháp với một nhóm người dùng nhỏ.' },
      { code: 'WS1-005', text: 'Đo lường kết quả bằng tiêu chí đã xác định.' },
      { code: 'WS1-006', text: 'Kết luận và đề xuất bước tiếp theo.' },
    ],
    qaChunks: [
      { code: 'WS1-090', text: 'Em muốn hỏi nên kiểm tra nhu cầu thế nào không ạ?' },
      { code: 'WS1-091', text: 'Giảng viên trả lời nên phỏng vấn trước khi xây.' },
    ],
  };
  const fallback = buildLocalWorkshopFallback(workshop);
  assert.match(fallback, /Workshop 1 — kiến thức chính/);
  assert.match(fallback, /Hỏi đáp đáng chú ý/);
  assert.match(fallback, /Ý trả lời/);
  assert.match(fallback, /\[WS1-\d{3}\]/);
  assert.doesNotMatch(fallback, /demo@example\.com/);
});

test('tìm Q&A theo chủ đề và lấy cả đoạn trả lời liền sau', () => {
  const workshop = {
    qaChunks: [
      { code: 'WS2-001', text: 'Mở phần hỏi đáp.' },
      { code: 'WS2-002', text: 'Em muốn hỏi về dữ liệu FinTech và KYC không ạ?' },
      { code: 'WS2-003', text: 'Giảng viên trả lời rằng nên dùng dữ liệu mẫu trước.' },
      { code: 'WS2-004', text: 'Sau đó mới chứng minh năng lực của sản phẩm.' },
      { code: 'WS2-005', text: 'Chuyển sang câu hỏi khác.' },
    ],
  };
  const source = findWorkshopQaSource(workshop, 'câu hỏi FinTech KYC');
  assert.match(source, /WS2-002.*FinTech/);
  assert.match(source, /WS2-003.*dữ liệu mẫu/);
});

test('không kéo workshop không đủ liên quan vào câu hỏi nhiều từ khóa', () => {
  const workshop = {
    qaChunks: [
      { code: 'WS1-001', text: 'Có câu hỏi chung về dữ liệu học tập.' },
      { code: 'WS1-002', text: 'Giảng viên trả lời về cách khảo sát.' },
    ],
  };
  assert.equal(findWorkshopQaSource(workshop, 'FinTech KYC'), '');
});
