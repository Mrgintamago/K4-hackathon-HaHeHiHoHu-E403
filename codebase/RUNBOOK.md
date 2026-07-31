# Hướng dẫn chạy bot

## Yêu cầu

- Node.js 20 trở lên.
- Discord test server và bot application riêng.
- OpenAI Platform API key.
- PDF bài học nằm ngoài repo, tên bắt đầu bằng `dd.mm.yyyy-`.

## 1. Cài đặt

```powershell
npm ci
Copy-Item .env.example .env
```

Điền `.env`; không commit file này. Các biến tối thiểu luôn cần là
`DISCORD_TOKEN`, `DISCORD_APP_ID`, `DISCORD_GUILD_ID`, và `OPENAI_API_KEY`.

Để hỏi bằng mention, bật `ENABLE_MENTION_QA=true`, khai báo
`MENTION_ALLOWED_CHANNEL_IDS`, và bật **Message Content Intent** trong Discord
Developer Portal. Đặt `LESSON_PDF_DIR` tới thư mục PDF private.

Để dùng tóm tắt Workshop 1/2 và hỏi đáp theo chủ đề, đặt `TRANSCRIPT_DIR` tới thư
mục private chứa `workshop01_transcript.md` và `workshop02_transcript.md`. Daily
reminder chỉ hiển thị Workshop 2 là hôm qua; Workshop 1 vẫn là nguồn để hỏi qua
mention.
Ví dụ mention: `@bot tóm tắt Workshop 2` hoặc
`@bot WS2 có câu hỏi nào về FinTech và KYC?`.

## 2. Kiểm tra trước khi chạy

```powershell
npm test
npm run eval
```

`npm run eval` ghi báo cáo vào `../eval/`. Báo cáo test tự động không đồng nghĩa
với việc toàn bộ golden set đã được chấm live bằng AI.

## 3. Chạy

```powershell
npm start
```

Log `Bot online: ...` cho biết kết nối thành công. Bot có single-instance lock tại
`data-private/bot.lock`; instance thứ hai sẽ từ chối chạy nếu PID cũ còn sống.

Bot hiện không đăng ký slash command. `npm run deploy` chỉ xóa command cũ trong
test guild, nên chỉ chạy một lần khi cần dọn command đã deploy trước đây.

## 4. Dừng và khắc phục

Trong terminal đang chạy bot, nhấn `Ctrl+C`. Nếu chạy nền trên Windows:

```powershell
Get-Content data-private\bot.lock
Stop-Process -Id <PID>
```

Chỉ dừng PID ghi trong lock sau khi xác nhận đó là process Node của bot. Lock cũ
sẽ được thay ở lần khởi động tiếp theo nếu PID không còn sống.

Các lỗi thường gặp:

- `Thiếu ...`: biến bắt buộc chưa có trong `.env`.
- Mention không phản hồi: kiểm tra Message Content Intent, guild ID và channel allowlist.
- Không tìm thấy bài: kiểm tra `LESSON_PDF_DIR` và tiền tố ngày `dd.mm.yyyy-`.
- `Bot đã chạy ở PID ...`: dừng instance cũ trước khi khởi động instance mới.

## Dữ liệu không được commit

Không commit `.env`, API key/token, PDF, transcript/data pack, `logs/`,
`data-private/`, export Discord hay dữ liệu user test có PII.
