# Reflection cá nhân — Lưu Nguyễn Ngọc Hân
**Dự án:** Discord Learning Assistant
**Vai trò:** Evidence, khảo sát và test

## 1. Vai trò
Trong nhóm, Hân phụ trách mảng thu thập evidence và khảo sát nhu cầu người dùng cho bot, đồng thời test bot để đảm bảo các tính năng hoạt động đúng trước khi deploy.

## 2. Phần đã làm
- Khảo sát nhu cầu của học viên và manager về cách tương tác với bot (mention trong channel, tra cứu tài liệu theo ngày, nhắc lịch Workshop) để làm căn cứ cho việc thiết kế tính năng.
- Thu thập evidence thực tế: tạo form thu nhập ý kiến của học viên về điểm chưa tối ưu của bot, tổng hợp các câu hỏi mẫu người dùng có thể hỏi bot, đối chiếu với khả năng đáp ứng của bot (ví dụ câu hỏi dạng "@bot WS2 nói về điều g?").
- Tổng hợp báo cáo evidence về mức độ hữu ích của reminder hằng ngày (bài hôm qua, bài hôm nay, lịch trong ngày) dựa trên phản hồi từ nhóm dùng thử.
- **Phần test bổ sung:**
  - Test luồng mention bot trong các channel nằm trong allowlist và ngoài allowlist (đảm bảo bot không phản hồi ngoài phạm vi cho phép).
  - Test tính năng tìm PDF theo định dạng tên file `dd.mm.yyyy-*.pdf`, kiểm tra trường hợp file sai định dạng tên hoặc không tồn tại.
  - Test giới hạn đọc tối đa 3 trang đầu của PDF, kiểm tra bot không suy đoán khi PDF thiếu nội dung liên quan.
  - Test việc che PII trước khi gửi câu hỏi/tài liệu tới AI, và che lại PII trên output AI trước khi gửi ra Discord.
  - Test rate limit theo user và khóa single-instance để phát hiện tình trạng bot chạy trùng.

## 3. AI hỗ trợ thế nào
AI được dùng để soạn bảng câu hỏi khảo sát, hỗ trợ phân loại và tóm tắt phản hồi khảo sát thành các nhóm nhu cầu chính. Trong phần test, AI hỗ trợ sinh nhanh các test case dựa trên danh sách tính năng (ví dụ liệt kê các biến thể tên file PDF hợp lệ/không hợp lệ để test), giúp không bỏ sót case biên. AI cũng hỗ trợ viết lại báo cáo evidence và checklist test theo cấu trúc rõ ràng, dễ đối chiếu với nhóm.

## 4. Bài học từ case fail của nhóm
Nhóm từng gặp sự cố khi các slash command cũ từ giai đoạn thử nghiệm trước đó vẫn còn tồn tại trên guild sau khi deploy phiên bản mới, khiến danh sách lệnh bị chồng chéo và gây nhầm lẫn cho người dùng. Bài học rút ra cho phần test: **không thể chỉ test tính năng mới, mà còn phải test trạng thái "sạch" của môi trường trước và sau deploy** — tức là cần có bước kiểm tra danh sách lệnh/guild command thực tế sau khi chạy `npm run deploy`, thay vì chỉ tin vào script đã chạy thành công. Từ đó, bổ sung thêm bước test hậu-deploy vào quy trình, không chỉ dừng ở test tính năng riêng lẻ.
