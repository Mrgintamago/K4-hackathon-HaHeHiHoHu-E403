# Pixel Pet Notifier

Chromium Manifest V3 extension nhận reminder từ local FastAPI server bằng WebSocket, fallback polling, rồi hiển thị pet và speech bubble trong Shadow DOM.

## Kiến trúc

```text
Discord bot / local app
  → POST localhost:8765/api/notifications
  → FastAPI memory queue
  → WebSocket /ws
  → MV3 service worker
  → content script
  → pixel pet + speech bubble
```

Service worker lưu history/seen IDs trong `chrome.storage.local`, dùng `chrome.alarms` để polling và đánh thức lại kết nối sau khi MV3 suspend.

## Load unpacked

1. Chạy local server theo `../local-server/README.md`.
2. Mở `chrome://extensions` hoặc `edge://extensions`.
3. Bật **Developer mode**.
4. Chọn **Load unpacked**.
5. Chọn thư mục `codebase/pixel-pet-extension`.
6. Mở Options, nhập cùng shared token với server.
7. Reload các tab web đang mở.

Chrome/Edge/Brave/Arc không cho content script chạy trên trang nội bộ như `chrome://`, Web Store và một số trang được bảo vệ.

Tạo gói ZIP để bàn giao:

```powershell
.\pixel-pet-extension\package-extension.ps1
```

## Kết nối Discord bot

Trong `codebase/.env`:

```dotenv
ENABLE_PIXEL_PET_NOTIFIER=true
PIXEL_PET_NOTIFICATION_URL=http://localhost:8765/api/notifications
PIXEL_PET_TOKEN=thay-bang-secret-ngau-nhien
```

Restart bot. Khi daily learning reminder được gửi Discord, bot đồng thời POST bản rút gọn sang Pixel Pet server. Lỗi local server không làm hỏng reminder Discord.

## Bảo mật

- Không dùng `eval`, remote script hoặc server-provided HTML.
- Chỉ text được đưa vào DOM bằng `textContent`.
- Payload, enum, độ dài và URL đều được validate.
- Mặc định chỉ cho endpoint loopback; LAN cần bật Advanced và có cảnh báo.
- Shared token nằm trong extension storage và `.env` local, không hard-code.
- Extension không đọc nội dung trang, lịch sử duyệt web hay gửi URL tab về server.
- Action chỉ chấp nhận HTTP(S); host ngoài localhost yêu cầu xác nhận theo mặc định.

Lưu ý: extension storage không phải secure enclave. Token nên là secret riêng cho máy local, không tái sử dụng mật khẩu quan trọng.

## Thay sprite

Placeholder hiện tại là `assets/pet.svg`. Có thể thay bằng PNG sprite sheet:

1. Thêm các file `pet-idle.png`, `pet-walk.png`, `pet-sleep.png`, `pet-excited.png`.
2. Giữ kích thước frame đồng nhất, nền trong suốt.
3. Đổi `<img>` thành phần tử dùng `background-image`.
4. Dùng `background-position` với animation `steps(frame-count)`.
5. Giữ `image-rendering: pixelated`.

Không tải sprite hoặc JavaScript từ CDN trong runtime.

## Manual checklist

- [ ] Load unpacked không có manifest error.
- [ ] Start local server và popup báo WebSocket connected.
- [ ] Gửi normal notification; pet excited và bubble tự đóng.
- [ ] Gửi high/urgent; bubble giữ đến khi đóng.
- [ ] Dừng server; pet hiện disconnected.
- [ ] Start lại server; extension tự reconnect.
- [ ] Action URL localhost mở đúng tab.
- [ ] URL ngoài localhost yêu cầu xác nhận.
- [ ] Drag pet, reload và kiểm tra vị trí được lưu.
- [ ] Double-click pet chạy interaction.
- [ ] Disabled website không inject pet.
- [ ] Reduced motion hoặc Pause animations dừng animation.
- [ ] Restart browser; history và unread count còn.
- [ ] Duplicate ID không hiển thị lần hai.
- [ ] Payload lỗi, HTML và `javascript:` URL bị bỏ.

## Rollback

Trước khi thêm Pixel Pet, repo đã có branch `backup/pre-pixel-pet-20260731` tại commit `74b0aa2`. Có thể tạo branch mới từ checkpoint đó; không cần xóa lịch sử hiện tại.
