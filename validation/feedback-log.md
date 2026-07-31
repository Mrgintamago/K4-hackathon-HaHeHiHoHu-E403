# Feedback log

| Người thử | Task | Quan sát | Quote nguyên văn | Mức nghiêm trọng |
|---|---|---|---|---|
| Hân | Mention hỏi bài hôm qua | Bot tìm đúng PDF ngày 30.07.2026, tóm tắt nội dung trang đầu, không lộ email/SĐT. Trả lời trong ~3 giây. | "Hỏi hôm qua học gì thì nó trả đúng bài, gọn gàng dễ hiểu" | Thấp |
| Hân | Mention hỏi bài hôm nay (không có PDF) | Bot trả "chưa tìm thấy tài liệu bài học phù hợp với ngày được hỏi" — không đoán file ngày khác. | "Nó nói thẳng là chưa có tài liệu, không bịa" | Thấp |
| Hân | Mention hỏi lịch workshop hôm nay | Bot đọc announcement từ manager, trả đúng WS có trong ngày. | "Trả lịch workshop nhanh, khỏi phải lên channel tìm" | Thấp |
| Hân | Chỉ mention bot, không hỏi gì | Bot reply "Bạn cần mình trợ giúp gì?" — không gọi AI. | "Mention không thì nó nhắc mình hỏi, không bị lỗi" | Thấp |
| Hân | Hỏi nội dung ngoài phạm vi ("Kể chuyện cười đi") | Bot không bịa, trả về nội dung liên quan đến bài học hoặc nói không tìm thấy. Câu trả lời hơi generic, chưa nói rõ "mình chỉ hỗ trợ lịch học". | "Nó không kể chuyện cười nhưng câu trả lời hơi lạ, nên nói thẳng là chỉ hỗ trợ bài học" | Trung bình |
| Sáng | Mention ở channel ngoài allowlist | Bot im lặng hoàn toàn, không reply, không react. Đúng kỳ vọng. | "Gửi ở channel khác thì bot không phản hồi gì, đúng thiết kế" | Thấp |
| Sáng | Mention ở channel trong denylist | Bot im lặng, không gọi AI. | "Channel bị cấm thì bot bỏ qua luôn" | Thấp |
| Sáng | Hỏi workshop nhưng announcement do user thường đăng | Bot bỏ qua bài đăng không có manager role, trả "chưa tìm thấy workshop". | "Chỉ tin thông báo từ quản lý, user thường đăng bị bỏ qua — đúng" | Thấp |
| Sáng | 2 PDF trùng ngày rồi hỏi bài | Bot không chọn bừa, trả "chưa tìm thấy tài liệu". | "Có 2 file cùng ngày thì nó không đoán, nói thẳng không tìm thấy" | Thấp |
| Sáng | Gửi 2 request liên tiếp (request đầu chưa xong) | Request thứ hai bị chặn, bot reply "đang xử lý câu hỏi trước". | "Gửi liên tục thì bị chặn, có thông báo rõ ràng" | Thấp |
| Sáng | Hỏi bài với ngày dd.mm.yyyy cụ thể | Bot parse đúng ngày tuyệt đối, tìm PDF và tóm tắt. Khi có cả "hôm qua" lẫn ngày cụ thể thì ưu tiên ngày tuyệt đối. | "Ghi ngày cụ thể thì nó hiểu đúng, không bị nhầm với hôm qua/hôm nay" | Thấp |
| Sáng | API timeout (mock OpenAI trả lỗi) | Bot reply "Xin lỗi bạn, mình đang gặp sự cố khi đọc tài liệu" — không lộ API key, token hay stack trace. | "Lỗi API thì message sạch, không lộ thông tin nhạy cảm" | Thấp |

## Tổng hợp

- Chủ đề lặp nhiều nhất: Bot xử lý đúng các trường hợp không có nguồn (PDF thiếu, trùng ngày, announcement từ non-manager) — luôn từ chối đoán và trả thông báo rõ ràng. Bảo mật tốt (channel/role check, rate limit, PII redact, không lộ lỗi kỹ thuật).
- Thay đổi làm trước demo: Cải thiện câu trả lời khi user hỏi ngoài phạm vi (case "Kể chuyện cười") — nên nói rõ "mình chỉ hỗ trợ lịch học và nội dung bài" thay vì trả lời generic.
- Giữ nguyên và lý do: Luồng 6 lớp bảo mật (guild → channel allowlist/denylist → role → rate limit → PII redaction → AI guardrails) hoạt động đúng, `findLessonPdf` không đoán khi 0 hoặc >1 file, `store: false` bảo vệ dữ liệu — tất cả đúng spec và an toàn.
- Backlog: (1) Tách rõ regex phân loại intent lesson/workshop/other để tránh gọi readFirstPage thừa khi hỏi workshop. (2) Thêm sanitized error message vào log nội bộ để dễ debug production. (3) Chạy live trọn bộ 20 golden-set case để hoàn tất R4.
