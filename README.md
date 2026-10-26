# SuperKanji

Ứng dụng học kanji từ file PowerPoint hoặc PDF. Người học tải tài liệu, kiểm tra kanji và từ ghép, rồi luyện bằng flashcard, Hán Việt, hoặc gõ hiragana.

## Chạy trên máy / server nhà

```bash
npm install
npx prisma db push
npm run dev
```

Mở http://localhost:3000 → **Đăng ký** tài khoản. Mỗi email có bài học và tiến độ riêng.

Dữ liệu lưu SQLite tại `data/superkanji.db`. Upload tối đa **500MB**.

## Dùng khi ở mạng khác (miễn phí, ≥500MB)

Xem [DEPLOY.md](./DEPLOY.md): chạy app trên máy nhà + **Tailscale**. Không dùng Vercel/Cloudflare nếu cần file lớn.

## Cách dùng

1. Tải file `.pptx` hoặc PDF có lớp chữ (tối đa 500MB).
2. Sửa bảng kiểm tra. Mục lấy từ file, gợi ý từ điển và mục chưa rõ được gắn nhãn khác nhau.
3. Bấm **Xác nhận và tạo bài**.
4. Mở bài và chọn một trong ba chế độ:
   - Flashcard
   - Hán Việt: gõ âm Hán Việt của từng kanji
   - Đọc kiểm tra: gõ hiragana của cả từ

File `.ppt` cũ bị từ chối vì có thể chứa macro. PDF scan được báo là chưa có OCR; ứng dụng không giả vờ đã nhận dạng ảnh.

Gợi ý từ điển chỉ điền vào ô đang trống và được đánh dấu là gợi ý. Âm hoặc nghĩa đã có trong file không bị ghi đè.

## Kiểm thử

```bash
npm test
```
