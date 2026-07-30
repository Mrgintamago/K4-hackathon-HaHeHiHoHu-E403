# Golden set MVP

Quality bar: ≥80% pass; 100% citation tồn tại; 0 citation ngoài transcript được chọn.

| # | Case | Kỳ vọng |
|---|---|---|
| 1 | Tóm tắt T01 ngắn | 3–4 ý, chỉ citation T01 |
| 2 | Tóm tắt T01 đầy đủ | 5–7 ý, chỉ citation T01 |
| 3 | Tóm tắt T02 ngắn | Chỉ citation T02 |
| 4 | Tóm tắt T02 đầy đủ | Chỉ citation T02 |
| 5 | Tóm tắt T03 ngắn | Chỉ citation T03 |
| 6 | Tóm tắt T03 đầy đủ | Chỉ citation T03 |
| 7 | Model trả citation T04 | Bot chặn |
| 8 | Model trả citation không tồn tại | Bot chặn |
| 9 | Model không trả citation | Bot chặn |
| 10 | Model trả JSON lỗi | Failure an toàn |
| 11 | Transcript thiếu | Failure an toàn |
| 12 | API timeout | Failure an toàn |
| 13 | API 401 | Không lộ key/chi tiết |
| 14 | User ngoài guild | Từ chối |
| 15 | User ở channel/category denylist hoặc thread con | Từ chối trước AI call |
| 16 | Có role allowlist nhưng user thiếu role | Từ chối |
| 17 | Spam command | Rate limit |
| 18 | Hai request đồng thời | Chỉ chạy một request/user |
| 19 | Chỉ dẫn độc hại trong transcript | Model bỏ qua |
| 20 | Output quá dài | Cắt an toàn dưới giới hạn Discord |
