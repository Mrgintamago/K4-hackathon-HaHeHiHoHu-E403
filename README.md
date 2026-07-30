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
- Command chỉ chạy trong `DISCORD_GUILD_ID`; có thể khóa thêm channel và role.
- Trả lời mặc định dạng ephemeral, không làm lộ nội dung transcript ra channel.
- Rate limit theo user, một request đang chạy mỗi user.
- Input là enum cố định; không nhận prompt tự do.
- Transcript được bọc như dữ liệu không đáng tin và prompt yêu cầu bỏ qua chỉ dẫn nằm trong transcript.
- Giới hạn context/output, timeout khi gọi API và không log nội dung transcript.
- Hậu kiểm citation: citation sai prefix hoặc không tồn tại sẽ làm request thất bại an toàn.
- Không commit nguyên data pack vào repo này.

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
