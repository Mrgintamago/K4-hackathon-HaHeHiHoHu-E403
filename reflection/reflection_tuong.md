# Reflection cá nhân — Cao Các Tường
**Dự án:** Discord Learning Assistant
**Vai trò:** Prompt và golden set

## 1. Vai trò
Tường phụ trách thiết kế prompt cho các tình huống hỏi-đáp của bot và xây dựng golden set (bộ câu hỏi — câu trả lời chuẩn) làm cơ sở đánh giá chất lượng phản hồi.

## 2. Phần đã làm
- Thiết kế prompt cho luồng trả lời câu hỏi dựa trên nội dung PDF bài học, với ràng buộc quan trọng: **không suy đoán khi thiếu nguồn** — nếu PDF không chứa thông tin liên quan, bot phải trả lời rõ là không tìm thấy thay vì bịa câu trả lời.
- Thiết kế prompt cho tính năng đọc lịch Workshop từ channel thông báo, chỉ tin nội dung dành cho manager role, tránh trộn lẫn thông tin không thuộc phạm vi được phép.
- Xây prompt cho reminder hằng ngày (bài hôm qua, bài hôm nay, lịch trong ngày) và tóm tắt Workshop 2 của hôm trước.
- Thiết kế prompt cho mention Q&A theo chủ đề (ví dụ: "@bot Tóm tắt workshop 2?"), đảm bảo bot chỉ trả lời trong phạm vi transcript liên quan.
- Xây dựng golden set gồm các cặp câu hỏi — câu trả lời mẫu bao phủ các tình huống: có nguồn rõ ràng, thiếu nguồn, câu hỏi ngoài phạm vi allowlist, câu hỏi liên quan PII.

## 3. AI hỗ trợ thế nào
AI hỗ trợ sinh nhanh nhiều biến thể câu hỏi để làm phong phú golden set, đặc biệt là các câu hỏi "khó" — dạng câu hỏi mập mờ hoặc thiếu ngữ cảnh để test xem bot có suy đoán sai hay không. AI cũng được dùng để thử nghiệm và tinh chỉnh prompt qua nhiều vòng lặp: đưa ra bản nháp prompt, chạy thử với các câu hỏi mẫu, so sánh output với golden set, rồi điều chỉnh lại câu chữ trong prompt cho chặt chẽ hơn.

## 4. Bài học từ case fail của nhóm
Một trong những case fail liên quan trực tiếp đến phần prompt: ở giai đoạn đầu, ràng buộc "không suy đoán khi thiếu nguồn" chưa được diễn đạt đủ chặt trong prompt, khiến bot đôi khi vẫn cố suy luận nội dung không có trong PDF khi bị hỏi các câu hỏi mập mờ. Việc này bộc lộ rõ hơn khi hệ thống deploy có lệnh cũ chồng chéo, khiến một số câu hỏi bị định tuyến sai và bot buộc phải "đoán" ngữ cảnh. Bài học: **prompt phải được viết với giả định rằng ngữ cảnh đầu vào có thể không hoàn chỉnh hoặc bị lỗi định tuyến**, nên luôn cần một câu lệnh rõ ràng yêu cầu bot từ chối trả lời thay vì suy đoán, và golden set cần bổ sung thêm các case "ngữ cảnh bị nhiễu" để kiểm tra độ chắc chắn của prompt trong thực tế, không chỉ trong điều kiện lý tưởng.
