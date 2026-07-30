# Kết quả eval

Thời điểm chạy: 2026-07-30 (Asia/Ho_Chi_Minh).

| Hạng mục | Kết quả | Đối chiếu quality bar |
|---|---:|---|
| Unit/integration test tự động | 14/14 pass | Đạt bộ kiểm tra code, không thay thế golden set |
| OpenAI Responses API smoke test với input giả | 1/1 pass | Xác nhận có AI call thật; không chứa data pack |
| Golden set 20 case | Chưa chấm live trọn bộ | Chưa đủ căn cứ tuyên bố đạt ≥80% |

Lệnh đã chạy: `npm test`, `npm run eval` (runner chạy test thành công nhưng lần ghi file bị sandbox chặn), và một live smoke call qua `summarizeLessonPage`.

Kết luận trung thực: prototype vượt toàn bộ automated checks hiện có và gọi AI thật thành công. Tuy nhiên chưa có bảng output/chấm từng case của 20-case golden set, vì vậy R4 “chạy trọn bộ” vẫn chưa hoàn tất. Không quy đổi 14 unit test thành 14/20 golden case.
