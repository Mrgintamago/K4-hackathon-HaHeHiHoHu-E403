# Changelog

Tất cả thay đổi đáng chú ý của HaHeHiHoHu Discord Learning Assistant được ghi
trong file này theo trình tự thời gian.

Format dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Prototype hiện vẫn dùng package version `0.1.0`; các mốc bên dưới được liên kết
với Git commit để có thể kiểm tra lại.

## [Unreleased]

### Added

- Đọc và tổng hợp tối đa 3 trang đầu của PDF bài học.
- System prompt giới hạn AI vào lịch chính thức, PDF và transcript Workshop được
  phép.
- Guardrail kiểm tra citation `[WSx-xxx]` trước khi gửi output Workshop.
- Phân loại đồng thời nhiều intent trong một câu hỏi, ví dụ bài hôm qua và lịch
  Workshop hôm nay.
- Phản hồi cố định khi mention ngoài channel allowlist hoặc thiếu role, không gọi
  AI và không đọc nguồn.
- Modal bắt buộc nhập blocker mới khi user chọn `Có blocker`.
- Card nhắc riêng cho user chưa gửi Daily Standup trong ngày.
- Log thao tác Standup theo cấu trúc `G-số nhóm → T-số team → user`, lưu trạng
  thái, blocker, ngày Standup và timestamp.
- Đọc group/team từ nickname Discord dạng `G10 - T003-...`.
- Cấu hình dự phòng `TEAM_STANDUP_GROUP_MAP`, ví dụ `T369:G3`.

### Changed

- Daily lesson reminder tổng hợp chủ đề, câu hỏi trọng tâm và nội dung chính từ
  cả 3 trang PDF; fallback cục bộ cũng dùng dữ liệu trang 1–3.
- Câu hỏi lịch chỉ đọc announcement chính thức; transcript chỉ được đọc khi hỏi
  nội dung, tóm tắt hoặc Q&A Workshop.
- Scheduler lưu khóa `ngày@giờ-phút`, tránh gửi trùng khi giữ nguyên lịch nhưng
  cho phép đổi giờ để kiểm thử trong cùng ngày.
- Standup card ưu tiên group/team từ nickname của owner và cập nhật lại header
  khi user tương tác.
- Khi blocker được cập nhật, cả dòng trạng thái và mục `Blocker` cuối card đều
  hiển thị nội dung mới.
- Bot tự thử kết nối lại Discord theo backoff khi gặp connect timeout.

### Security

- Channel denylist và guild không hợp lệ tiếp tục bị bỏ qua hoàn toàn.
- Bot kiểm tra quyền gửi tin nhắn trước khi phản hồi.
- Thông báo từ chối quyền được rate-limit để tránh spam.
- PII được che trước AI call, sau AI call và trước khi ghi nội dung blocker.
- Raw Standup, transcript và PDF không được ghi vào action log.
- Runtime log/state chỉ nằm trong `codebase/data-private/` hoặc `codebase/logs/`
  và bị Git ignore.

### Tests

- Bổ sung test cho PDF 3 trang, multi-intent/multi-date, citation guard,
  Workshop retrieval, PII, nickname G/T, blocker modal data và log phân cấp.
- Trạng thái kiểm thử local gần nhất: `37/37` pass.

## [dc6e16b] - 2026-07-31 10:52 +07:00

### Added

- Parser cho `workshop01_transcript.md` và `workshop02_transcript.md`, hỗ trợ cả
  marker thường, marker in đậm và mã đoạn bị lặp.
- Tóm tắt nội dung giảng viên và phần hỏi đáp cuối Workshop.
- Tìm Q&A theo chủ đề và lấy các đoạn trả lời liền sau.
- Daily reminder có tóm tắt Workshop 2 của hôm qua.
- Mention Q&A cho `WS1`, `WS2` và `Workshop 1/2`.
- PII redaction hai chiều cho input và output AI.
- Fallback cục bộ khi AI không tạo được lesson summary.
- Tự retry đăng nhập Discord khi kết nối timeout.

### Tests

- Thêm test Workshop parser, Q&A retrieval, PII và lesson reminder fallback.

## [9f0c2a1] - 2026-07-31 00:40 +07:00

### Documentation

- Cập nhật README để khớp flow bot, cấu hình, bảo mật và cách vận hành hiện tại.

## [858f921] - 2026-07-30 23:27 +07:00

### Added

- Mention Q&A dựa trên PDF bài học và announcement chính thức.
- Tìm PDF theo ngày với tên `dd.mm.yyyy-*.pdf`.
- Daily learning reminder.
- Daily Standup reminder và card trạng thái.
- PII redaction, rate limit theo user và in-flight lock.
- Single-instance lock để tránh chạy trùng bot.
- Unit/integration test, eval runner, Dockerfile và runbook.

### Security

- Chỉ đọc announcement từ manager role.
- Không đoán khi thiếu hoặc trùng PDF cùng ngày.
- Không gửi raw Standup tới AI.
- Giới hạn guild, channel, role và độ dài output.

## [2b1ae51] - 2026-07-30 17:37 +07:00

### Changed

- Merge nhánh `main` của repository nhóm.

## [c4ceb49] - 2026-07-30 17:36 +07:00

### Documentation

- Cập nhật README ban đầu.

## [5b67d3d] - 2026-07-30 17:27 +07:00

### Added

- Channel denylist.
- Role allowlist với cách kiểm tra nhiều role theo phép OR.
- Chặn thread có parent nằm trong denylist.

## [5d3e816] - 2026-07-30 17:14 +07:00

### Added

- Phiên bản đầu của Discord Day 2 summary bot.
- Gọi AI thật để tóm tắt transcript học tập.
- Citation validation theo mã transcript.
- Cấu hình environment và các kiểm soát bảo mật cơ bản.

[Unreleased]: https://github.com/Mrgintamago/K4-hackathon-HaHeHiHoHu-E403/compare/dc6e16b...HEAD
[dc6e16b]: https://github.com/Mrgintamago/K4-hackathon-HaHeHiHoHu-E403/commit/dc6e16b
[9f0c2a1]: https://github.com/Mrgintamago/K4-hackathon-HaHeHiHoHu-E403/commit/9f0c2a1
[858f921]: https://github.com/Mrgintamago/K4-hackathon-HaHeHiHoHu-E403/commit/858f921
[2b1ae51]: https://github.com/Mrgintamago/K4-hackathon-HaHeHiHoHu-E403/commit/2b1ae51
[c4ceb49]: https://github.com/Mrgintamago/K4-hackathon-HaHeHiHoHu-E403/commit/c4ceb49
[5b67d3d]: https://github.com/Mrgintamago/K4-hackathon-HaHeHiHoHu-E403/commit/5b67d3d
[5d3e816]: https://github.com/Mrgintamago/K4-hackathon-HaHeHiHoHu-E403/commit/5d3e816
