# 🍜 Thổ Địa Local - Web App Tìm Kiếm Địa Điểm Ăn Uống

Chào mừng bạn đến với dự án **Thổ Địa Local**! Đây là một ứng dụng web hiện đại giúp người dùng tìm kiếm các địa điểm ăn uống, cafe và check-in dựa trên khu vực và khung giờ hoạt động thực tế.

## 🚀 Tính năng nổi bật

- **Thiết kế Premium**: Giao diện đẹp mắt, hiệu ứng kính (Glassmorphism), tối ưu hoàn toàn cho di động.
- **Bộ lọc thông minh**: Tự động nhận diện giờ hệ thống (Sáng/Trưa/Chiều/Tối) để gợi ý quán đang mở.
- **Dữ liệu thời gian thực**: Kết nối trực tiếp với Google Sheets thông qua Google Apps Script.
- **Tốc độ cực nhanh**: Xây dựng trên nền tảng Vite và React 19.

## 🛠 Công nghệ sử dụng

- **Frontend**: React 19, Vite.
- **Styling**: Tailwind CSS v4.
- **Icons**: Lucide React.
- **Database**: Google Sheets (via Apps Script).

## 📂 Cấu trúc dự án

- `src/App.jsx`: Chứa toàn bộ giao diện và logic chính của ứng dụng.
- `src/index.css`: Cấu hình Tailwind CSS và phong cách chung.
- `public/`: Chứa các tài sản tĩnh (hình ảnh, favicon).

## ⚙️ Hướng dẫn cài đặt & Chạy local

1. **Cài đặt thư viện**:
   ```bash
   npm install
   ```

2. **Chạy ứng dụng**:
   ```bash
   npm run dev
   ```
   Sau đó truy cập vào địa chỉ: `http://localhost:5173`

## 🔗 Kết nối dữ liệu Google Sheets

1. Mở Google Sheet của bạn.
2. Vào **Extensions** -> **Apps Script**.
3. Dán mã Script tối ưu (đã được cung cấp) vào.
4. Nhấn **Deploy** -> **New Deployment** -> **Web App**.
5. Copy đường dẫn URL nhận được.
6. Mở file `src/App.jsx`, tìm dòng `const SCRIPT_URL = '...'` và dán URL của bạn vào.

## 📄 Giấy phép

Dự án này được phát triển bởi **Antigravity AI** cho mục đích cộng đồng. Bạn có thể tự do sử dụng và chỉnh sửa.

## GAS Mới (Dedup + Commercial Rank)

- Script mới nằm tại: [gas/Code.gs](/d:/Project Handmade/WebAmThuc/web-app/gas/Code.gs)
- Hướng dẫn triển khai: [gas/README.md](/d:/Project Handmade/WebAmThuc/web-app/gas/README.md)
- Cột mới cần thêm trong sheet:
`merchant_id`, `sponsor_tier`, `boost_score`
