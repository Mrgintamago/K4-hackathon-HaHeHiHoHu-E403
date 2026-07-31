import json
import os
import urllib.request

payload = json.dumps({
    "title": "Đến giờ học rồi!",
    "message": "Workshop AI bắt đầu trong 10 phút.",
    "type": "reminder",
    "priority": "high",
    "actionUrl": "http://localhost:3000/schedule",
    "actionLabel": "Mở lịch",
}).encode()
request = urllib.request.Request(
    "http://localhost:8765/api/notifications",
    data=payload,
    headers={
        "Content-Type": "application/json",
        "X-Pixel-Pet-Token": os.getenv("PIXEL_PET_TOKEN", ""),
    },
    method="POST",
)
with urllib.request.urlopen(request, timeout=5) as response:
    print(response.read().decode())
