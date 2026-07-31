# Reflection cá nhân — Nguyễn Xuân Quang
**Dự án:** Discord Learning Assistant
**Vai trò:** Bot, bảo mật và deploy

## 1. Vai trò
Quang phụ trách phát triển lõi bot và triển khai (deploy) hệ thống lên môi trường thực tế.

## 2. Phần đã làm
- Xây dựng cơ chế lắng nghe mention bot trong các channel nằm trong allowlist, đảm bảo bot không phản hồi ngoài phạm vi channel được cấu hình.
- Cài đặt logic tìm và đọc file PDF theo định dạng tên `dd.mm.yyyy-*.pdf`, giới hạn chỉ đọc tối đa 3 trang đầu để tránh xử lý quá tải và lộ nội dung ngoài phạm vi cần thiết.
- Xây dựng module đọc lịch Workshop từ channel thông báo, gắn logic phân quyền theo manager role.
- Triển khai cơ chế gửi reminder tự động (bài hôm qua, bài hôm nay, lịch trong ngày) và daily reminder có tóm tắt Workshop.
- Xây dựng cơ chế **che PII** hai chiều: che PII trước khi gửi câu hỏi/nội dung tài liệu tới AI, và che lại PII trên output AI trước khi gửi ra Discord; đảm bảo transcript chỉ được truy hồi theo đoạn liên quan và không được commit vào repo.
- Cài đặt rate limit theo user và khóa single-instance để tránh tình trạng nhiều bản bot chạy trùng nhau.
- Viết deploy script (`npm run deploy`) để xóa các guild command cũ đã từng được deploy, do bot không đăng ký slash command.

## 3. AI hỗ trợ thế nào
AI hỗ trợ Quang debug các lỗi logic trong quá trình xử lý mention, đọc file PDF và cơ chế rate limit; đồng thời hỗ trợ review lại luồng che PII để đảm bảo không có điểm rò rỉ giữa bước gửi tới AI và bước nhận output. AI cũng hỗ trợ đề xuất cách tổ chức deploy script để dọn dẹp guild command cũ một cách an toàn, tránh ảnh hưởng tới các lệnh đang hoạt động bình thường.

## 4. Bài học từ case fail của nhóm
Đây là case fail liên quan trực tiếp nhất tới phần việc của Quang: trong giai đoạn thử nghiệm sớm, nhóm từng deploy slash command thử nghiệm lên guild, nhưng chưa có cơ chế dọn dẹp, khiến các lệnh cũ tồn đọng song song với lệnh mới. Hệ quả là danh sách lệnh bị chồng chéo, một số lệnh cũ trỏ tới handler đã bị xóa trong code, gây lỗi khi người dùng gọi nhầm lệnh cũ. Cùng thời điểm đó, việc chưa có khóa single-instance khiến có lúc hai bản bot chạy song song, gửi reminder trùng lặp vào channel.

Bài học rút ra: **hạ tầng triển khai (deploy, lock, rate limit) cần được thiết kế song song với tính năng ngay từ đầu, không phải là phần "thêm sau"**. Từ sự cố này, nhóm quyết định bot sẽ không đăng ký slash command và bổ sung bước dọn guild command cũ vào chính script deploy, đồng thời thêm khóa single-instance và rate limit theo user để chặn tận gốc tình trạng chạy trùng.
