# HaHeHiHoHu — Discord Bot tóm tắt Day 2

Prototype hackathon: slash command `/tomtat-day2` tóm tắt ba phần transcript Day 2 và trả kết quả có citation `[T01-NNN]`, `[T02-NNN]`, `[T03-NNN]`.

## Thành viên và phân công

| Thành viên | Phần việc |
|---|---|
| Hân | Evidence và khảo sát |
| Tường | Prompt và golden set |
| Quang | Bot, bảo mật và deploy |
| Sáng | Spec và kịch bản rủi ro |
| Thành | Eval và validation |

## Cấu trúc repo

```text
.
├── README.md
├── spec.md
├── demo-slides.pdf       # bổ sung trước CP6
├── codebase/
├── eval/
├── validation/
└── reflection/
```

## Chạy nhanh

Yêu cầu Node.js 20+ và một Discord test server.

```powershell
cd codebase
Copy-Item .env.example .env
npm install
npm run deploy
npm start
```

Điền token/key trong `.env`. Bot dùng OpenAI Responses API với model mặc định `gpt-5-nano`. Đây là OpenAI Platform API key, không phải token đăng nhập Codex/ChatGPT. `TRANSCRIPT_DIR` phải trỏ tới thư mục private chứa đúng các file nguồn; bot chỉ load `transcript-01-clean.md`, `transcript-02-clean.md`, `transcript-03-clean.md`.

## Biện pháp bảo mật MVP

- Token/API key chỉ đọc từ environment, `.env` đã bị gitignore.
- Command chỉ chạy trong `DISCORD_GUILD_ID`. `DENIED_CHANNEL_IDS` chặn nhiều channel/category; thread có parent bị chặn cũng bị từ chối. `ALLOWED_ROLE_IDS` là allowlist nhiều role tùy chọn.
- Trả lời mặc định dạng ephemeral, không làm lộ nội dung transcript ra channel.
- Rate limit theo user, một request đang chạy mỗi user.
- Input là enum cố định; không nhận prompt tự do.
- Transcript được bọc như dữ liệu không đáng tin và prompt yêu cầu bỏ qua chỉ dẫn nằm trong transcript.
- Giới hạn context/output, timeout khi gọi API và không log nội dung transcript.
- Hậu kiểm citation: citation sai prefix hoặc không tồn tại sẽ làm request thất bại an toàn.
- Không commit nguyên data pack vào repo này.

### Cấu hình quyền nhiều channel

Bot được phép hoạt động ở mọi channel trong guild, ngoại trừ denylist:

```env
DENIED_CHANNEL_IDS=111111111111111111,222222222222222222
ALLOWED_ROLE_IDS=333333333333333333,444444444444444444
```

Để `ALLOWED_ROLE_IDS` trống nếu mọi thành viên trong guild đều được gọi bot. Nên deny thêm `View Channel` cho bot role tại các channel nhạy cảm để có hai lớp bảo vệ. Kiểm tra trong code diễn ra trước khi đọc transcript hoặc gọi OpenAI nên request bị chặn không tốn token AI.

## Command

```text
/tomtat-day2 phan:sang-bai-toan muc_do:ngan
/tomtat-day2 phan:chi-so-tu-dong-hoa muc_do:ngan
/tomtat-day2 phan:chieu-rang-buoc muc_do:day-du
```

## Docker

```powershell
docker build -t day2-discord-bot ./codebase
docker run --env-file ./codebase/.env `
  -e TRANSCRIPT_DIR=/private-transcripts `
  -v "C:\duong-dan\toi\transcript:/private-transcripts:ro" `
  --restart unless-stopped day2-discord-bot
```

Khi deploy, mount/copy transcript vào thư mục private ngoài web root và đặt `TRANSCRIPT_DIR` tương ứng.
