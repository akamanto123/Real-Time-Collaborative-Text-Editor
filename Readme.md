# Hệ Thống Soạn Thảo Văn Bản Cộng Tác (Collaborative Document Editing System)

Một playground full-stack để xây dựng một trình soạn thảo văn bản cộng tác, giữ nhiều client đồng bộ gần như theo thời gian thực. Dự án sử dụng frontend React/Vite kèm API Express + Socket.IO với MongoDB làm lưu trữ. Logic Operational Transform (OT) chạy cả trên client và server giúp các chỉnh sửa nhất quán ngay cả khi nhiều người dùng gõ cùng lúc.

## 👥 Thành Viên Thực Hiện

* **Bùi Xuân Trường** - B22DCCN878 


* **Hoàng Đinh Phong** - B22DCCN614 


* **Nguyễn Duy Hải Đăng** - B22DCCN208 


* **Giảng viên hướng dẫn:** Kim Ngọc Bách 



*Hà Nội - 2026* 

## 🚀 Tính Năng Chính

### 1. Yêu Cầu Chức Năng Cơ Bản

* **Tạo và quản lý tài liệu:** Thêm, xem, sửa, xóa tài liệu; hiển thị thông tin tác giả, ngày khởi tạo và chỉnh sửa.


* **Chỉnh sửa cộng tác thời gian thực:** Độ trễ cập nhật dưới 500ms, hỗ trợ các thao tác ký tự cơ bản và tính năng tự động lưu (Autosave).


* **Đồng bộ & Giải quyết xung đột:** Sử dụng thuật toán **Operational Transform (OT)** kết hợp số thứ tự (`sequence number`) để đảm bảo tính nhất quán dữ liệu tối hậu trên mọi client.


* **Quản lý phiên làm việc:** Hiển thị danh sách người dùng đang hoạt động, vị trí con trỏ (màu sắc riêng biệt), vùng chọn (selection) và trạng thái tham gia/rời phòng.


* **Lưu trữ bền vững:** Toàn bộ dữ liệu cấu trúc rõ ràng được lưu trữ an toàn trên đám mây MongoDB Atlas.



### 2. Chức Năng Nâng Cao

* Lịch sử chỉnh sửa và quản lý phiên bản (Versioning).


* Cơ chế Hoàn tác/Làm lại (Undo/Redo) trong môi trường phân tán.


* Hỗ trợ chỉnh sửa ngoại tuyến (Offline Editing) và tự động đồng bộ lại khi có mạng.


* Phân quyền chi tiết người dùng (`Owner`, `Editor`, `Viewer`).


---

## 🏗️ Kiến Trúc Hệ Thống

Hệ thống được tổ chức theo **kiến trúc phân cấp (kiến trúc dọc)** dưới dạng mô hình cây giúp tối ưu luồng dữ liệu:

1. **Gốc (Database/Model):** Lưu trữ trạng thái bền vững (Persisted State).


2. **Thân/Nhánh (SocketServer):** Tách trạng thái động theo từng `Room ID`, đảm bảo các thao tác của tài liệu này không bị gửi nhầm sang tài liệu khác.


3. **Lá (Client Sockets):** Nhận dữ liệu hạ lưu đã được lọc sạch từ phòng trực thuộc.

### Luồng xử lý thao tác (Operation Pipeline)

* **Client Upstream:** Khởi tạo thao tác -> Diff nội dung -> Đóng gói thành `Operation` kèm `Base Revision` -> Đánh dấu *In-flight* và gửi lên server.


* **Server Ingestion:** Tiếp nhận -> Kiểm tra quyền (Role) -> Xác thực gói tin -> Phát hiện xung đột bằng cách so sánh số hiệu phiên bản hệ thống và client.


* **Server Transformation & Persistence:** Chạy thuật toán OT giải quyết xung đột -> Áp dụng thay đổi vào văn bản gốc -> Tăng `Global Revision` -> Ghi log dữ liệu và lưu vào DB.


* **Downstream Broadcast:** Gửi tín hiệu xác nhận (*ACK*) cho client gửi để giải phóng hàng đợi; đồng thời *Broadcast* thao tác đã qua biến đổi tới các client khác trong phòng để cập nhật giao diện.



---

## Công Nghệ

| Lớp      | Công cụ                               |
| -------- | ------------------------------------- |
| Frontend | React 19, Vite, Socket.IO client      |
| Backend  | Node.js, Express, Socket.IO, Mongoose |
| Database | MongoDB / MongoDB Atlas               |

---

# Mô Hình Đồng Bộ Dữ Liệu

Hệ thống sử dụng sự kết hợp giữa **mô hình kênh sự kiện (Event Channel Model)** và **mô hình dữ liệu tập trung (Centralized Data Model)** để hình thành nên các không gian dữ liệu chia sẻ (Shared Data Spaces).

## 🔄 Cơ Chế Giao Tiếp (Event-Driven)

* **Giao tiếp qua Socket.IO:** Client và Server trao đổi dữ liệu hoàn toàn bằng các sự kiện định sẵn như:
  * `join-document`: Tham gia vào phòng tài liệu.
  * `submit-operation`: Gửi thao tác chỉnh sửa từ client lên server.
  * `document-operation`: Server phát tán thao tác chỉnh sửa đến các client khác.
  * `cursor-move`: Cập nhật vị trí con trỏ chuột thời gian thực.
* **Vai trò của Socket.IO:** Đóng vai trò là mạng trung gian (**Middleware**) điều phối, phát tán (broadcast) sự kiện tới tất cả các client đã đăng ký (`subscribe`) vào phòng tài liệu đó.
* **Tách biệt liên kết (Decoupling):** Client và Server không truy xuất trực tiếp vào nhau mà tương tác gián tiếp thông qua **Kênh sự kiện (Event Channel)**.

## 💾 Kiến Trúc Lưu Trữ (Centralized Data)

Về mặt lưu trữ, hệ thống áp dụng **mô hình dữ liệu tập trung** ở phía Backend:
* **Server là kho dữ liệu chung (Single Source of Truth):** Đóng vai trò trung tâm lưu trữ toàn bộ trạng thái của tài liệu.
* **Luồng dữ liệu:** Client bắt buộc phải đi qua Server để lấy hoặc ghi lại trạng thái mới nhất của tài liệu, đảm bảo tính nhất quán dữ liệu giữa các phiên làm việc.

---

## 📡 Giao Thức Trao Đổi Dữ Liệu

Hệ thống kết hợp linh hoạt hai phương thức giao tiếp mạng:

* **WebSocket (Socket.IO):** Phục vụ các tác vụ thời gian thực qua cơ chế Full-duplex (Sự kiện: `join-document`, `submit-operation`, `cursor-move`,...). Có cơ chế tự động hạ cấp xuống HTTP Long-Polling nếu mạng lỗi.


* **HTTP (REST API):** Chạy trên Express Framework, phục vụ các tác vụ quản trị tài liệu CRUD tuần tự truyền thống.



---

## 🧪 Kiểm Thử Và Đánh Giá

### Các trường hợp thử nghiệm (Test Cases) thành công

* Kết nối, tham gia phòng và tải trạng thái ban đầu của tài liệu (`document-state`).


* Đồng bộ thay đổi thời gian thực cơ bản giữa các tab trình duyệt.


* Xử lý xung đột bằng OT thành công khi nhiều client cùng chèn/xóa tại một vị trí.


* Quản lý xếp hàng thao tác bằng cơ chế *In-flight* và *Operation ACK*.


* Đồng bộ và xóa con trỏ/vùng chọn động của người dùng khác.


* Ngắt kết nối, kết nối lại và tái đồng bộ dữ liệu (`request-resync`).


* Chặn các gói tin lỗi, không hợp lệ hoặc sai quyền (`Viewer` cố tình chỉnh sửa).



### 📊 Đánh giá kết quả thực nghiệm

#### Tiêu chí ĐẠT

* Nội dung văn bản đồng bộ chính xác tuyệt đối giữa các client khi gõ ở tốc độ thông thường (dưới 40 từ/phút).


* Không xảy ra hiện tượng xung đột hiển thị; số hiệu phiên bản (`Revision`) tăng tuần tự ổn định.


* Cơ chế đồng bộ con trỏ và resync khi mất kết nối hoạt động đúng thiết kế.



#### Hạn chế tồn tại (Tiêu chí CHƯA ĐẠT)

* Khi người dùng thực hiện thao tác xóa hoặc gõ quá nhanh (tốc độ vượt ngưỡng ~40 từ/phút), hệ thống đôi khi xuất hiện hiện tượng bị sót chữ.


* Quá trình gõ tiếng Việt (sử dụng Unikey/Telex) thỉnh thoảng gặp lỗi lặp từ/ký tự (`duplicate`) do xung đột cơ chế bắt sự kiện phím.

## Bắt Đầu

### 1. Clone repository

Mở terminal và thực hiện lệnh cài đặt:
```bash
# Cài đặt dependencies cho Backend Server
cd server
npm install

# Cài đặt dependencies cho Frontend Client
cd ../Client
npm install
```

### 2. Cấu hình biến môi trường

- **Server** (`server/.env`)

  ```env
  MONGO_URI=chuoi_ket_noi_mongodb_cua_ban
  PORT=3000
  ```
  *(Thay thế `MONGO_URI` bằng đường dẫn kết nối MongoDB thực tế của bạn).*

- **Cấu hình Client** (`Client/.env`):
  ```env
  VITE_API_URL=http://localhost:3000
  ```

_(Các file môi trường được git bỏ qua; sao chép từ `.env.example` nếu có.)_

###3Install dependencies

```bash
# Server
cd server
npm install

- **Terminal 2 (Frontend Client)**:
  ```bash
  cd Client
  npm run dev
  ```
  *Vite dev server sẽ chạy ứng dụng Client tại địa chỉ mặc định `http://localhost:5173`. Mở trình duyệt và truy cập liên kết này để sử dụng.*

### 4. Chạy ứng dụng

Mở hai terminal riêng biệt:

```bash
# Backend
cd server
npm run dev        # hoặc npm start cho môi trường production

# Frontend
cd ../Client
npm run dev        # khởi chạy Vite dev server tại http://localhost:5173
```

Mở client trong trình duyệt, tạo hoặc chọn một tài liệu và bắt đầu chỉnh sửa. Mở cùng tài liệu trong cửa sổ hoặc trình duyệt khác sẽ demo tính năng cộng tác thời gian thực.

## Cấu trúc dự án

```
Client/                 Frontend React (Vite)
  src/
    App.jsx
    main.jsx
    index.css
    api/                Helper REST + socket cho client
    components/         Giao diện danh sách tài liệu & trình soạn thảo
    hooks/              Bộ quản lý trạng thái OT tuỳ chỉnh
    ot/                 Helper Operational Transform
  package.json
  vite.config.js
  README.md
  eslint.config.js
server/                 Backend Express + Socket.IO
  src/
    app.js
    server.js
    config/             Cấu hình DB và môi trường
    controllers/        Xử lý REST
    models/             Mongoose schema và model
    ot/                 Tiện ích Operational Transform phía server
    routes/             Định tuyến REST
    sockets/            Kênh tài liệu thời gian thực
    utils/              Helper lưu trữ
  test/                 Tests OT
    ot.test.js
  package.json
  README.md
.gitignore              Quy tắc bỏ qua chung (client + server)
BACKEND_REQUIREMENTS.md  Tài liệu phụ thuộc backend
package.json            Root package config
simple_ws_server.js     Ví dụ WebSocket server
socket-test.js          Tập tin thử nghiệm socket
```

## Ghi chú Operational Transform

- Client xếp hàng các chỉnh sửa cục bộ cho đến khi server xác nhận với revision được cập nhật.
- Các thao tác từ xa đến sẽ được biến đổi so với các thao tác cục bộ đang chờ để tránh sai lệch ký tự khi gõ nhanh.
- Server lưu lại thao tác đã biến đổi, tăng revision và truyền broadcast đến tất cả client đang kết nối.

## Scripts

| Vị trí   | Lệnh              | Mô tả                      |
| -------- | ----------------- | -------------------------- |
| `Client` | `npm run dev`     | Vite development server    |
|          | `npm run build`   | Build production           |
|          | `npm run preview` | Xem trước bản build        |
|          | `npm run lint`    | Kiểm tra ESLint            |
| `server` | `npm run dev`     | Nodemon development server |
|          | `npm start`       | Khởi động production       |

## Đóng góp

1. Fork repo và tạo branch tính năng.
2. Commit các thay đổi với thông điệp rõ ràng.
3. Đảm bảo lint/tests chạy thành công.
4. Tạo pull request mô tả thay đổi và cách kiểm thử.
