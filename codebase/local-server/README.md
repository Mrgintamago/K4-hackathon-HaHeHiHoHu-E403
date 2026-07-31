# Pixel Pet local server

FastAPI server chỉ chạy trên máy người dùng, nhận notification qua HTTP rồi broadcast qua WebSocket. Khuyến nghị Python 3.11–3.13; Python 3.14 có thể chưa có wheel cho mọi dependency trên Windows.

## Chạy server

```powershell
cd codebase\local-server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PIXEL_PET_TOKEN="thay-bang-secret-ngau-nhien"
uvicorn app:app --host 127.0.0.1 --port 8765
```

Health check: `http://localhost:8765/health`.

Gửi thử:

```powershell
$env:PIXEL_PET_TOKEN="thay-bang-secret-ngau-nhien"
python send_test.py
```

Chạy test backend:

```powershell
pip install -r requirements-dev.txt
pytest -q
```

Hoặc:

```bash
curl -X POST http://localhost:8765/api/notifications \
  -H "Content-Type: application/json" \
  -H "X-Pixel-Pet-Token: thay-bang-secret-ngau-nhien" \
  -d '{"title":"Time to study","message":"Complete your lesson.","type":"reminder","priority":"high"}'
```

Server giữ tối đa 200 notification trong RAM và mất lịch sử khi restart. Không bind `0.0.0.0` nếu chưa có firewall và nhu cầu LAN rõ ràng.
