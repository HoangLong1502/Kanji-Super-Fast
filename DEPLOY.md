# Dùng SuperKanji mọi nơi (miễn phí, upload tới 500MB)

Vercel/Cloudflare Free **không** đủ 500MB. Cách đúng với máy server ở nhà: **Tailscale** (VPN mesh miễn phí).

- Upload: tới **500MB** (giới hạn app), không bị CDN cắt
- Không cần mở port router
- Truy cập từ điện thoại / máy khác khi đã đăng nhập cùng tài khoản Tailscale

## 1. Chạy app trên máy server nhà

Trong thư mục SuperKanji:

```bash
npm install
npx prisma db push
npm run serve
```

App lắng nghe mọi interface (`0.0.0.0:3000`). Giữ máy bật và lệnh này chạy (hoặc đặt Windows Service / Task Scheduler sau).

## 2. Cài Tailscale (miễn phí)

1. Tạo tài khoản tại https://login.tailscale.com  
2. Cài Tailscale trên **máy server** và đăng nhập  
3. Cài Tailscale trên **điện thoại / laptop mang đi** và đăng nhập **cùng tài khoản**  
4. Trên máy server, mở Tailscale → copy **Tailscale IP** (dạng `100.x.x.x`)

## 3. Mở web khi ở mạng khác

Trên máy/điện thoại đã có Tailscale:

```text
http://100.x.x.x:3000
```

( thay `100.x.x.x` bằng IP Tailscale của máy server )

Lần đầu Windows có thể hỏi firewall: cho phép Node.js / mạng Private.

## Kiểm tra nhanh

| Ở đâu | URL |
|---|---|
| Trên chính máy server | http://localhost:3000 |
| Cùng nhà (LAN) | http://IP-LAN:3000 |
| Ngoài đường (qua Tailscale) | http://100.x.x.x:3000 |

## Tài khoản

Mở web lần đầu → **Đăng ký** email + mật khẩu. Mỗi người một tài khoản; bài học và tiến độ tách riêng. Đăng xuất ở góc trên.

Thêm vào `.env` trên máy server:

```env
AUTH_SECRET="chuoi-bi-mat-dai-ngau-nhien"
```

## Lưu ý

- Máy server phải **bật** và app phải **đang chạy**
- Upload 500MB phụ thuộc tốc độ upload mạng nhà (có thể mất vài phút)
- Ảnh OCR (JPG/PNG/…) lần đầu cần mạng để tải model tiếng Nhật; các lần sau nhanh hơn
- Không dùng Cloudflare Tunnel / Vercel nếu cần ≥500MB (họ cắt nhỏ hơn)
