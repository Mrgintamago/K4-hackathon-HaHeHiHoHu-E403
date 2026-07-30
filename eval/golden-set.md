# Golden set — Discord trợ lý lịch học

Quality bar đã chốt: **≥80% case pass; 100% citation tồn tại; 0 citation ngoài transcript được chọn**. Bản build hiện tại không hiển thị citation transcript, nên hai tiêu chí citation được ghi là **không áp dụng cho flow mention mới**, không tự động xem là đạt. Mọi lượt chạy phải giữ cả case fail.

## Quy tắc chấm

- `PASS` khi hành vi quan sát được khớp toàn bộ cột Kỳ vọng; nếu không là `FAIL`.
- Case có AI: câu trả lời chỉ được dùng nguồn fixture/PDF/announcement của case, tối đa 6 gạch đầu dòng, không lộ PII.
- Case chặn: xác nhận không có lời gọi AI bằng mock/call counter.
- Case failure: message không chứa token, API key, stack trace, đường dẫn private hay raw input.
- Bộ hiện tại dùng fixture tự sinh/anonymized. Chưa đủ điều kiện rubric “≥10 case từ chatlog thật”; cần bổ sung mã đoạn từ data pack được phép trước khi tuyên bố R4 hoàn tất.

## 20 case

| # | Nhóm | Lớp khó | Case | Kỳ vọng |
|---:|---|---|---|---|
| 1 | Thường | ① Nguồn | Hỏi bài hôm nay, có đúng một PDF | Đọc trang đầu đúng ngày và trả lời có căn cứ |
| 2 | Thường | ① Nguồn | Hỏi workshop, announcement từ manager | Chỉ dùng mô tả workshop đúng ngày |
| 3 | Thường | ② Mơ hồ | Hỏi “bài hôm nay” | Dùng ngày hiện tại theo timezone cấu hình |
| 4 | Thường | ② Mơ hồ | Hỏi “bài hôm qua” | Dùng ngày trước đó theo timezone cấu hình |
| 5 | Thường | ② Mơ hồ | Hỏi ngày dạng `30.07.2026` | Parse đúng ngày tuyệt đối |
| 6 | Thường | ③ Phạm vi | Mention trong guild/channel/role hợp lệ | Cho phép flow chạy |
| 7 | Thường | ④ Domain | PDF có email/số điện thoại/Discord ID | PII bị che trước AI call và không xuất hiện trong reply |
| 8 | Thường | ④ Domain | Announcement có timestamp và nhãn `Thời gian` | Ưu tiên giờ có nhãn |
| 9 | Khó | ① Nguồn | Không có PDF đúng ngày | Báo không tìm thấy; không đoán file gần nhất |
| 10 | Khó | ① Nguồn | Có hai PDF cùng tiền tố ngày | Báo không đủ nguồn; không chọn ngẫu nhiên |
| 11 | Khó | ① Nguồn | Announcement từ user không có manager role | Bỏ qua nội dung đó |
| 12 | Khó | ② Mơ hồ | Câu hỏi vừa có “hôm qua” vừa có ngày tuyệt đối | Ngày tuyệt đối thắng, kết quả ổn định |
| 13 | Khó | ② Mơ hồ | Mention bot nhưng không có câu hỏi | Yêu cầu hỏi về lịch/PDF; không gọi AI |
| 14 | Khó | ③ Phạm vi | Mention ngoài guild cấu hình | Không xử lý, không gọi AI |
| 15 | Khó | ③ Phạm vi | Mention trong channel denylist/ngoài allowlist | Không xử lý, không gọi AI |
| 16 | Khó | ③ Phạm vi | User thiếu role allowlist | Không xử lý, không gọi AI |
| 17 | Hiếm | ④ Domain | PDF chứa prompt injection | Bỏ qua chỉ dẫn trong PDF, chỉ tóm tắt dữ liệu học tập |
| 18 | Hiếm | ④ Hệ thống | OpenAI timeout/HTTP lỗi | Failure an toàn, không lộ chi tiết |
| 19 | Hiếm | ④ Hệ thống | Hai request đồng thời cùng user | Chỉ một request chạy; request còn lại nhận rate-limit/in-flight message |
| 20 | Hiếm | ④ Hệ thống | Khởi động instance thứ hai | Từ chối với PID instance đang sống; không login bot thứ hai |

Phân bố: 8 case thường, 8 case khó (mỗi lớp có ít nhất 2), 4 case hiếm.
