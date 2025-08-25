# Giao diện Giao Dịch Phái Sinh (HTML/CSS/JS thuần)

Giao diện mẫu mô phỏng màn hình giao dịch hợp đồng tương lai / perp giống hình tham chiếu (app di động). Không dùng framework – chỉ **HTML**, **CSS**, **JavaScript** thuần.

## Thành phần chính

- Thanh tiêu đề: Tên cặp, % thay đổi, nút thao tác.
- Biểu đồ mini (canvas) + ticker giá cao/thấp/khối lượng.
- Sổ lệnh (order book) với asks / bids cập nhật giả lập mỗi 2s.
- Form đặt lệnh: Chế độ ký quỹ (Isolated/Cross), đòn bẩy, loại lệnh, giá, số lượng, phần trăm, TP/SL, Reduce Only.
- Tính toán nhanh: Margin ước tính & giá thanh lý (đơn giản hoá).
- Nút Buy/Long / Sell/Short đổi màu theo chiều.
- Danh sách Vị thế & Lệnh chờ (placeholder).
- Thanh điều hướng đáy giống ứng dụng di động.

## Chạy
Mở trực tiếp `index.html` trong trình duyệt (mobile hoặc dev tools responsive). Không cần build.

Trên desktop, giao diện được đóng khung trong một "khung điện thoại" cố định 414x844 để mô phỏng app di động. Thu nhỏ chiều ngang vẫn responsive. Ở màn hình nhỏ (<=650px) khung chuyển sang full-bleed như app thực.

## Tùy chỉnh nhanh
- Sửa biến màu trong `:root` (light) hoặc `.theme-dark` ở `styles.css`.
- Có nút 🌙 / ☀️ trên thanh trên cùng để đổi theme.
- Thay logic mô phỏng giá trong hàm `tick()` ở `script.js`.
- Điều chỉnh công thức tính margin / liquidation ở `updateCalc()`.

## Lưu ý
Tính toán margin & giá thanh lý chỉ là minh họa, KHÔNG sử dụng cho giao dịch thật.

---
MIT License – Dùng tự do.
