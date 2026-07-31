# HaHeHiHoHu — Discord Learning Assistant

## Pixel Pet Notifier (optional)

Repo có thêm Chromium Manifest V3 extension và FastAPI local server để đẩy daily reminder từ bot ra một pixel pet trên trang web. Tính năng mặc định tắt và không ảnh hưởng Discord bot.

- Extension: `codebase/pixel-pet-extension/README.md`
- Local server: `codebase/local-server/README.md`
- Rollback checkpoint: branch `backup/pre-pixel-pet-20260731`, commit `74b0aa2`

Prototype hackathon hỗ trợ học tập trực tiếp trong Discord. Bot trả lời câu hỏi về bài học từ PDF private, đọc lịch Workshop từ channel thông báo, gửi daily reminder và chuyển Daily Standup tới channel cá nhân.

## Thành viên và phân công

| Thành viên | Phần việc |
|---|---|
| Hân | Evidence và khảo sát |
| Tường | Prompt và golden set |
| Quang | Bot, bảo mật và deploy |
| Sáng | Spec và kịch bản rủi ro |
| Thành | Eval và validation |

## Tính năng hiện tại

- Hỏi bot bằng mention trong các channel được allowlist.
- Tìm PDF theo ngày từ tên file `dd.mm.yyyy-*.pdf` và chỉ đọc tối đa 3 trang đầu.
- Trả lời câu hỏi về bài học dựa trên PDF, không suy đoán khi thiếu nguồn.
- Đọc lịch Workshop từ channel thông báo; chỉ tin nội dung của manager role.
- Gửi reminder gồm bài hôm qua, bài hôm nay và lịch trong ngày.
- Daily reminder thêm tóm tắt Workshop 2 của hôm qua; Workshop 1/2 vẫn dùng được cho mention Q&A từ transcript private.
- Có thể mention bot để hỏi nội dung hoặc Q&A theo chủ đề, ví dụ `@bot WS2 có câu hỏi nào về FinTech/KYC?`.
- Đọc Daily Standup theo team và gửi card có nút cập nhật trạng thái tới channel cá nhân.
- Che PII trước khi gửi câu hỏi hoặc nội dung tài liệu tới AI.
- Che lại PII trên output AI trước khi gửi Discord; transcript chỉ được truy hồi theo đoạn liên quan và không được commit.
- Rate limit theo user và khóa single-instance để tránh chạy trùng bot.

Bot **không đăng ký slash command**. Script `npm run deploy` chỉ xóa các guild command cũ đã từng được deploy.

## Kiến trúc

```text
Discord mention
    -> kiểm tra guild, channel, role và rate limit
    -> xác định ngày/nội dung được hỏi
    -> đọc tối đa 3 trang đầu PDF và/hoặc lịch Workshop đáng tin cậy
    -> che dữ liệu cá nhân
    -> OpenAI Responses API (store: false)
    -> reply trong channel, không cho phép mention phát sinh

Scheduler
    -> Daily reminder -> channel cá nhân
    -> Daily Standup -> parse tại chỗ -> card + nút trạng thái
```

Các module chính:

| File | Vai trò |
|---|---|
| `codebase/src/bot.js` | Discord event handlers và luồng mention Q&A |
| `codebase/src/config.js` | Đọc và kiểm tra cấu hình environment |
| `codebase/src/ai.js` | Gọi OpenAI Responses API |
| `codebase/src/lessons.js` | Tìm PDF theo ngày và đọc tối đa 3 trang đầu |
| `codebase/src/announcements.js` | Trích lịch từ thông báo đáng tin cậy |
| `codebase/src/reminders.js` | Daily learning reminder |
| `codebase/src/standups.js` | Parse, gửi và cập nhật Daily Standup |
| `codebase/src/privacy.js` | Che PII và làm sạch câu hỏi |
| `codebase/src/security.js` | Authorization, rate limit và in-flight lock |

## Yêu cầu

- Node.js 20 trở lên.
- Discord application và test server riêng.
- OpenAI Platform API key.
- PDF bài học nằm ngoài Git repository.

Trong Discord Developer Portal, bật **Message Content Intent** nếu dùng mention Q&A. Chỉ cấp các quyền cần thiết: View Channel, Read Message History, Send Messages và Embed Links; không cấp Administrator.

## Cài đặt

```powershell
cd codebase
npm ci
Copy-Item .env.example .env
```

Điền `.env`; không commit token, API key hoặc dữ liệu private. Các biến tối thiểu để khởi động:

```env
DISCORD_TOKEN=
DISCORD_APP_ID=
DISCORD_GUILD_ID=
OPENAI_API_KEY=
```

Bot dùng OpenAI Responses API. Model mặc định hiện tại là `gpt-5.6-luna` và có thể thay bằng `OPENAI_MODEL`.

## Bật mention Q&A

```env
ENABLE_MENTION_QA=true
MENTION_ALLOWED_CHANNEL_IDS=111111111111111111
LESSON_PDF_DIR=../pdf
```

PDF phải có tên bắt đầu bằng ngày, ví dụ:

```text
30.07.2026-thu-nam.pdf
```

Bot không đoán nếu không có file hoặc có nhiều file trùng ngày. `DENIED_CHANNEL_IDS` là denylist toàn guild; `ALLOWED_ROLE_IDS` là allowlist role tùy chọn:

```env
DENIED_CHANNEL_IDS=111111111111111111,222222222222222222
ALLOWED_ROLE_IDS=333333333333333333,444444444444444444
RATE_LIMIT_SECONDS=30
```

Để `ALLOWED_ROLE_IDS` trống nếu mọi member trong guild đều được dùng bot.

Channel denylist và guild khác bị bỏ qua hoàn toàn. Mention ngoài channel allowlist hoặc
thiếu role nhận thông báo cố định, không đọc nguồn và không gọi AI. Nếu bot thiếu quyền
gửi tin nhắn, bot chỉ ghi log lỗi tổng quát.

## Bật daily reminder

```env
ENABLE_DAILY_REMINDER=true
DISCORD_ANNOUNCEMENT_CHANNEL_ID=111111111111111111
DISCORD_MANAGER_ROLE_IDS=222222222222222222
USER_PERSONAL_CHANNEL_MAP=123456789012345678:333333333333333333
REMINDER_HOUR=8
REMINDER_MINUTE=0
REMINDER_TIMEZONE=Asia/Ho_Chi_Minh
```

Khi cấu hình `DISCORD_REMINDER_CHANNEL_ID`, thông báo học tập hằng ngày được gửi vào channel chung này. Nếu để trống, bot mới dùng các channel trong `USER_PERSONAL_CHANNEL_MAP`. Reminder Standup vẫn dùng channel cá nhân. Khi daily reminder được bật, bot yêu cầu channel nguồn thông báo và ít nhất một manager role.

## Bật Daily Standup

```env
ENABLE_STANDUP_REMINDER=true
TEAM_STANDUP_CHANNEL_MAP=T203:111111111111111111,T204:222222222222222222
TEAM_STANDUP_GROUP_MAP=T203:G1,T204:G1
USER_PERSONAL_CHANNEL_MAP=123456789012345678:333333333333333333
STANDUP_REMINDER_HOUR=21
STANDUP_REMINDER_MINUTE=30
STANDUP_MANAGER_ROLE_IDS=444444444444444444
```

Bot đọc message có tiêu đề `✅ Stand-up đã ghi nhận`, parse các mục `Hôm qua`, `Hôm nay`,
`Blocker`, rồi gửi card tới channel cá nhân. Chỉ chủ standup hoặc manager được cập nhật
trạng thái. `Đã làm`/`Chưa xong` được ghi ngay; `Có blocker` bắt buộc nhập blocker mới
qua modal. Lịch sử riêng tư được lưu tại `data-private/standup-action-log.json` theo cây
`G-số nhóm → T-số team → user`. Raw standup không được gửi tới AI hoặc ghi vào action log.
User có trong `USER_PERSONAL_CHANNEL_MAP` nhưng chưa gửi Standup trong ngày sẽ nhận card
nhắc “Chưa ghi nhận Daily Standup” tại channel cá nhân.

## Kiểm tra và chạy

```powershell
npm test
npm run eval
npm start
```

- `npm test` chạy test tự động.
- `npm run eval` tạo báo cáo trong thư mục `eval/` ở root repository.
- `npm start` chạy bot; log `Bot online: ...` xác nhận kết nối thành công.

Bot tạo lock tại `codebase/data-private/bot.lock`. Nếu instance cũ còn chạy, instance mới sẽ từ chối khởi động. Xem [RUNBOOK.md](codebase/RUNBOOK.md) để biết cách dừng bot và xử lý lỗi thường gặp.

## Docker

Build từ root repository:

```powershell
docker build -t hahehihohu-discord-bot ./codebase
docker run --env-file ./codebase/.env `
  -e LESSON_PDF_DIR=/private-pdf `
  -v "C:\duong-dan\toi\pdf:/private-pdf:ro" `
  --restart unless-stopped hahehihohu-discord-bot
```

Docker image chỉ chứa source cần để chạy bot. Mount PDF private ở chế độ read-only và đặt `LESSON_PDF_DIR` tương ứng.

## Dữ liệu không được commit

Không commit:

- `.env`, Discord token hoặc API key;
- PDF bài học và transcript/data pack;
- Discord export, log và dữ liệu user test có PII;
- `logs/`, `data-private/` hoặc state runtime.

Nếu dữ liệu nhạy cảm từng được Git theo dõi, thêm vào `.gitignore` không xóa dữ liệu đó khỏi lịch sử Git.

## Cấu trúc repository

```text
.
├── README.md
├── spec.md
├── codebase/       # source, test, Dockerfile và runbook
├── eval/           # báo cáo đánh giá
├── validation/     # bằng chứng validation
└── reflection/     # tổng kết hackathon
```
