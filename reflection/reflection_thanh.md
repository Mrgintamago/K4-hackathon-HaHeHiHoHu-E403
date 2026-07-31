# Reflection cá nhân — Lê Qúy Thành
**Dự án:** Discord Learning Assistant
**Vai trò:** Data mining và validation

## 1. Vai trò
Thành phụ trách thu nhập dữ liệu từ các video record, xử lý các yêu cầu bảo mật (che PII, rate limit, khóa single-instance) và validation để xác nhận các luồng tính năng hoạt động đúng như spec trước khi đưa vào sử dụng thực tế.

## 2. Phần đã làm
- Thành thực hiện bước thu nhập dữ liệu từ các video record của Workshop sau đó biến đổi thành dạng Transcript để làm dữ liệu input.
- Validate luồng che PII: kiểm tra output thực tế của bot trên Discord để xác nhận không còn sót thông tin cá nhân sau bước che PII hai chiều (trước khi gửi AI và trước khi gửi Discord).
- Đánh giá độ chính xác của reminder hằng ngày (bài hôm qua, bài hôm nay, lịch trong ngày) và phần tóm tắt Workshop 2, đối chiếu với nội dung gốc trong channel thông báo.
- Validate việc phân quyền đọc lịch Workshop theo đúng manager role, đảm bảo không có rò rỉ thông tin ngoài phạm vi.
- Theo dõi và ghi nhận các case lỗi thực tế (bao gồm case slash command cũ/mới xung đột) để phản hồi lại cho Quang và Sáng phục vụ việc cải tiến spec và deploy script.

## 3. AI hỗ trợ thế nào
AI giúp thu nhập transcript ở mức cơ bản (vẫn cần sự rà soát lại của Thành). AI cũng hỗ trợ tổng hợp báo cáo validation theo từng tính năng, so sánh kết quả trước/sau khi các bản fix (như dọn guild command cũ, thêm khóa single-instance) được triển khai, giúp nhóm thấy rõ mức độ cải thiện.

## 4. Bài học từ case fail của nhóm
Có giai đoạn tên file video record không khớp đúng định dạng mà hệ thống mong đợi, khiến một phần dữ liệu bị bỏ sót ngay từ khâu khai thác mà không ai hay biết — vì quá trình này chạy ngầm và không báo lỗi rõ ràng. Vấn đề chỉ lộ ra muộn, khi Thành đối chiếu ở bước validation và thấy nội dung reminder/tóm tắt Workshop thiếu một phần so với video gốc.

Bài học rút ra: lỗi ở khâu đầu vào thường "im lặng" — không crash, không báo lỗi, chỉ âm thầm làm thiếu dữ liệu — nên không thể chỉ dựa vào việc chương trình chạy xong mà kết luận dữ liệu đã đầy đủ. Từ đó bạn đưa thêm một bước đối soát: sau mỗi lần khai thác, so số lượng video record đầu vào với số transcript sinh ra, để phát hiện sớm phần bị rơi rớt thay vì chờ đến lúc validation cuối mới phát hiện ra.