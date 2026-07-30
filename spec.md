# AI SPEC — Discord Bot tóm tắt Day 2 · Nhóm HaHeHiHoHu

Hướng: B — Trợ lý Học viên · Loại: Tính năng mới

## §1. User & Job

- Job executor: học viên nghỉ hoặc cần ôn nhanh Day 2 trước khi làm bài.
- Core JTBD: nắm lại các ý quan trọng của một phần bài giảng trong vài phút thay vì đọc lại toàn bộ transcript.
- Problem statement: học viên phải tự đọc transcript dài, tốn thời gian và dễ bỏ sót kiến thức quan trọng.
- Evidence: đang thu qua khảo sát; cần ≥20 người ngoài nhóm hoặc mining đủ chuẩn rubric.

## §2. Impact & quyết định chọn

MVP chọn tóm tắt Day 2 vì ba transcript đã có cấu trúc citation kiểm chứng được và có thể demo end-to-end trong một giờ. Lịch tự động, deadline và ingest Discord được loại vì chưa có nguồn chính thức đáng tin.

## §3. Giải pháp tương tự

- NotebookLM: học cách gắn câu trả lời với nguồn; tránh tạo cảm giác model luôn đúng.
- Discord bot thông thường: học flow slash command ngắn; tránh nhận prompt tự do trong MVP.

## §4. Thiết kế

- Lát cắt: Một học viên cần ôn Day 2 · chọn một phần qua `/tomtat-day2` · AI chọn ý chính có căn cứ · trả summary và citation.
- Non-goals: không đọc Discord; không quản lý lịch/deadline; không trả lời kiến thức ngoài Day 2; không tự gửi DM.
- Prototype: Working cho một command, AI call thật.
- Automation: Conditional — chỉ trả khi citation hậu kiểm hợp lệ; sai kiến thức có cost-of-error cao.
- G1: mô tả command nói rõ chỉ hỗ trợ Day 2.
- G2: output nói rõ nguồn transcript đã chọn.
- G10: input ngoài enum bị Discord từ chối; thiếu nguồn thì failure an toàn.
- G11: mỗi ý có citation để người dùng kiểm tra.

## §5. Kiểu lỗi

| Tình huống | Lớp | Hành vi mong muốn |
|---|---|---|
| Model bịa citation | Nguồn sự thật | Chặn output |
| File transcript thiếu | Nguồn sự thật | Báo cấu hình nguồn lỗi |
| Không chọn phần | Mơ hồ | Dùng choice bắt buộc |
| Muốn tóm tắt toàn bộ ngày | Mơ hồ | Yêu cầu chọn một phần để giới hạn context |
| Hỏi deadline | Ngoài phạm vi | Không có input tự do, hướng về command |
| Muốn bot post toàn server | Ngoài phạm vi | Ephemeral mặc định |
| Trộn khái niệm giữa phần học | Domain | Chỉ load đúng một file |
| Prompt injection trong transcript | Domain/bảo mật | Coi transcript là data, bỏ qua chỉ dẫn bên trong |

## §6. Bốn đường đi

- Happy: chọn phần → AI trả summary có citation hợp lệ.
- Low-confidence: model báo thiếu căn cứ → bot không suy đoán.
- Failure: timeout/API/citation lỗi → thông báo riêng tư, không lộ chi tiết hệ thống.
- Correction: chạy lại command với phần hoặc mức độ khác.

## §7. Kiểm thử

- Golden set: xem `eval/golden-set.md`.
- Quality bar: ≥80% case pass; 100% citation tồn tại; 0 output có citation sai prefix hoặc ngoài nguồn.

## §8. Phân công

Xem bảng trong `README.md`. Người thử ngoài nhóm sẽ được ghi trong `validation/feedback-log.md`.

## §9. Changelog

| Thời điểm | Đổi gì | Vì sao |
|---|---|---|
| MVP 1 giờ | Thu scope về ba transcript Day 2; thêm allowlist, rate limit, ephemeral và citation validation | Ưu tiên demo chạy được và giảm rủi ro bảo mật |

