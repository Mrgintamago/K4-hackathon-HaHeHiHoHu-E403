# AI SPEC — Discord Bot trợ lý lịch học · Nhóm HaHeHiHoHu

Hướng: B — Trợ lý Học viên · Loại: Tính năng mới

## §1. User & Job

- Job executor: học viên cần biết lịch và nội dung bài học gần nhất ngay trong Discord.
- Core JTBD: hỏi bằng mention để nhận câu trả lời ngắn có căn cứ từ thông báo chính thức hoặc trang đầu PDF, thay vì tự tìm nhiều channel/file.
- Problem statement: lịch và tài liệu nằm ở nhiều nơi; học viên tốn thời gian tìm và có thể dùng nhầm thông tin không chính thức.
- Evidence: đang thu qua khảo sát; cần ≥20 người ngoài nhóm hoặc mining đủ chuẩn rubric.

## §2. Impact & quyết định chọn

MVP chọn hỏi lịch/bài học trong Discord vì announcement của manager và PDF theo ngày là hai nguồn có thể giới hạn, kiểm tra và demo end-to-end. Tóm tắt toàn bộ transcript, đọc channel thảo luận và tự quyết định deadline bị loại vì phạm vi rộng và cost-of-error cao.

## §3. Giải pháp tương tự

- NotebookLM: học cách giới hạn câu trả lời theo nguồn; tránh tạo cảm giác model luôn đúng.
- Discord bot thông thường: học flow mention ngắn và phản hồi ngay trong ngữ cảnh học viên đang làm việc.

## §4. Thiết kế

- Lát cắt: Một học viên cần biết lịch hoặc nội dung bài theo ngày · mention bot trong channel học tập · AI diễn giải dữ liệu từ announcement/PDF được phép · trả câu trả lời ngắn hoặc báo không đủ nguồn.
- Non-goals: không đọc channel thảo luận; không tự đặt deadline; không trả lời ngoài announcement/PDF; không gửi nội dung standup vào AI; không dùng slash command.
- Prototype: Working — Discord event, đọc nguồn tại chỗ và OpenAI Responses API đều chạy thật. Reminder/standup là lát cắt bổ trợ.
- Automation: Conditional — chỉ đọc nguồn allowlist và trả failure an toàn khi không có nguồn; sai lịch có cost-of-error cao.
- G1: khi không có nguồn, bot nói rõ không tìm thấy thay vì đoán.
- G2: câu hỏi và câu trả lời gắn với ngày được yêu cầu.
- G10: channel/role/guild không hợp lệ bị chặn trước AI call; lỗi provider trả thông báo an toàn.
- G11: dữ liệu PII được che trước khi vào prompt; answer bị giới hạn độ dài.

## §5. Kiểu lỗi

| Tình huống | Lớp | Hành vi mong muốn |
|---|---|---|
| Announcement từ người không có manager role | ① Nguồn sự thật | Bỏ qua trước khi dựng context |
| Thiếu hoặc trùng PDF cùng ngày | ① Nguồn sự thật | Không đoán file; trả không đủ nguồn |
| Câu hỏi không ghi ngày | ② Mơ hồ/ngữ cảnh | Mặc định hôm nay theo timezone cấu hình |
| Câu hỏi có ngày `dd.mm.yyyy` | ② Mơ hồ/ngữ cảnh | Parse đúng ngày, không dùng timestamp ngẫu nhiên |
| Hỏi nội dung ngoài lịch/PDF | ③ Ngoài phạm vi | Nói không tìm thấy trong nguồn được phép |
| Mention ở channel không allowlist | ③ Ngoài phạm vi | Không phản hồi và không gọi AI |
| Prompt injection trong PDF/announcement | ④ Domain/bảo mật | Coi nguồn là data, bỏ qua chỉ dẫn bên trong |
| PDF/announcement chứa PII | ④ Domain/bảo mật | Che PII trước khi đưa vào prompt |
| API timeout/HTTP lỗi | ④ Hệ thống/bảo mật | Thông báo failure an toàn, không lộ key/stack |

## §6. Bốn đường đi

- Happy: mention + ngày hợp lệ → lấy đúng announcement/PDF → AI trả lời ngắn có căn cứ.
- Low-confidence: không có đúng một PDF hoặc không có announcement phù hợp → bot nói không tìm thấy, không suy đoán.
- Failure: timeout/API/read lỗi → thông báo an toàn, log chỉ mã lỗi tổng quát.
- Correction: học viên mention lại với ngày rõ ràng hơn; manager sửa nguồn announcement/PDF rồi thử lại.

## §7. Kiểm thử

- Golden set 20 case: xem `eval/golden-set.md`; báo cáo từng lượt ở `eval/results.md`/`results.json`.
- Unit test kiểm tra parser, privacy, authorization, standup và citation guard; live smoke kiểm tra một OpenAI call thật. Full golden set phải được chấm riêng, không suy diễn từ số unit test.
- Quality bar: ≥80% case pass; 100% citation tồn tại; 0 output có citation sai prefix hoặc ngoài nguồn.

## §8. Phân công

Xem bảng trong `README.md`. Người thử ngoài nhóm sẽ được ghi trong `validation/feedback-log.md`.

## §9. Changelog

| Thời điểm | Đổi gì | Vì sao |
|---|---|---|
| MVP 1 giờ | Thu scope về ba transcript Day 2; thêm allowlist, rate limit, ephemeral và citation validation | Ưu tiên demo chạy được và giảm rủi ro bảo mật |
| Bản demo hiện tại | Chuyển interaction chính sang mention hỏi lịch/PDF; thêm reminder và standup; giữ nguyên quality bar đã chốt | Khớp nguồn vận hành và nhu cầu demo thực tế; ghi rõ thay đổi scope thay vì sửa lịch sử |
