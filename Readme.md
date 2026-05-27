# Hướng dẫn chạy và Báo cáo Đồ án: Trình soạn thảo văn bản cộng tác thời gian thực

Dự án này là một nền tảng soạn thảo văn bản cộng tác thời gian thực (Collaborative Rich Text Editor) theo mô hình Client-Server. Hệ thống cho phép nhiều người dùng cùng biên tập một tài liệu đồng thời với cơ chế tự động đồng bộ nhất quán và giải quyết xung đột bằng thuật toán **Operational Transformation (OT)**.

---

## I. HƯỚNG DẪN CHẠY DỰ ÁN (GETTING STARTED)

### 1. Yêu cầu hệ thống
- **Node.js** (phiên bản 16 trở lên)
- **MongoDB** (máy chủ chạy cục bộ hoặc tài khoản MongoDB Atlas trên đám mây)

### 2. Cài đặt các gói phụ thuộc (Dependencies)
Dự án được chia tách rõ ràng thành hai phần: `server` (Backend) và `Client` (Frontend).

Mở terminal và thực hiện lệnh cài đặt:
```bash
# Cài đặt dependencies cho Backend Server
cd server
npm install

# Cài đặt dependencies cho Frontend Client
cd ../Client
npm install
```

### 3. Cấu hình biến môi trường (Environment Variables)
Tạo tệp cấu hình môi trường `.env` trong cả hai thư mục tương ứng:

- **Cấu hình Server** (`server/.env`):
  ```env
  MONGO_URI=mongodb://localhost:27017/collaborative-editor
  PORT=3000
  ```
  *(Thay thế `MONGO_URI` bằng đường dẫn kết nối MongoDB thực tế của bạn).*

- **Cấu hình Client** (`Client/.env`):
  ```env
  VITE_API_URL=http://localhost:3000
  ```

### 4. Khởi chạy ứng dụng
Chạy đồng thời cả Frontend và Backend bằng cách mở hai terminal riêng biệt:

- **Terminal 1 (Backend Server)**:
  ```bash
  cd server
  npm run dev
  ```
  *Nodemon sẽ khởi chạy server tại địa chỉ `http://localhost:3000`.*

- **Terminal 2 (Frontend Client)**:
  ```bash
  cd Client
  npm run dev
  ```
  *Vite dev server sẽ chạy ứng dụng Client tại địa chỉ mặc định `http://localhost:5173`. Mở trình duyệt và truy cập liên kết này để sử dụng.*

---

## II. BÁO CÁO ĐỒ ÁN (PROJECT REPORT)

### 1. Kiến trúc hệ thống (System Architecture)
Hệ thống được thiết kế theo mô hình **Client-Server** kết hợp cơ chế truyền thông hai chiều thời gian thực thông qua WebSocket:

- **Client (Frontend)**:
  - Xây dựng bằng **React** kết hợp **Vite** để đảm bảo tốc độ phản hồi giao diện nhanh chóng.
  - Sử dụng **Socket.IO client** kết nối liên tục đến Server để trao đổi các thao tác chỉnh sửa (Operations).
  - Có cơ chế **Offline resilience** (Lưu trữ ngoại tuyến): Khi mất mạng, các chỉnh sửa chưa được xác nhận sẽ tự động lưu tạm vào `localStorage` và đồng bộ lại ngay khi kết nối Internet được phục hồi.

- **Server (Backend)**:
  - Xây dựng trên nền tảng **Node.js** và **Express**.
  - **Socket.IO server** quản lý danh sách kết nối WebSocket và tổ chức các Client biên tập chung vào các phòng (Rooms) phân biệt theo mã tài liệu (`documentId`).
  - **OT Engine** nằm ở server có nhiệm vụ thu nhận các thao tác chỉnh sửa từ Client, đối chiếu phiên bản, thực hiện biến đổi hoạt động (Transformation) để giải quyết xung đột trước khi lưu xuống Database và gửi truyền phát (broadcast).

- **Database (Cơ sở dữ liệu)**:
  - **MongoDB** và **Mongoose** được dùng để lưu trữ thông tin tài liệu (Tiêu đề, nội dung, phiên bản hiện tại).
  - Bảng ghi lịch sử hoạt động (`opsLog` nằm trong document schema) lưu lại toàn bộ các thao tác đã áp dụng thành công theo trình tự thời gian và chỉ số phiên bản (`appliedRevision`). Điều này giúp server tính toán và chuyển đổi các operation đến muộn.
  - Bảng ghi `snapshots` lưu trữ các điểm khôi phục của tài liệu cứ sau mỗi khoảng thời gian cấu hình (ví dụ: 30 giây khi có thay đổi), giúp người dùng xem lại lịch sử phiên bản và khôi phục khi cần thiết.

```
   ┌────────────────┐                     ┌────────────────┐
   │    Client 1    │ <─── WebSocket ───> │                │
   │  (React/Vite)  │                     │  Socket.IO &   │
   └────────────────┘                     │  Express Server│ <───> MongoDB
   ┌────────────────┐                     │  (OT Engine)   │
   │    Client 2    │ <─── WebSocket ───> │                │
   │  (React/Vite)  │                     └────────────────┘
   └────────────────┘
```

---

### 2. Mô hình đồng bộ dữ liệu (Data Synchronization Model)
Dự án áp dụng mô hình **Operational Transformation (OT)** với kiến trúc **Single-In-Flight** để đồng bộ dữ liệu văn bản dạng ký tự giữa các client mà không làm gián đoạn trải nghiệm gõ phím của người dùng.

#### Cách thức hoạt động của mô hình:
1. **Trạng thái cục bộ (Local State)**:
   - Mỗi Client giữ một bản sao của tài liệu cùng chỉ số phiên bản đã được máy chủ xác nhận (`revision`).
   - Khi người dùng gõ phím hoặc xóa chữ, hệ thống ngay lập tức tạo ra một thao tác (`insert` hoặc `delete`) và áp dụng lên màn hình soạn thảo của chính họ mà không cần chờ máy chủ phản hồi (Độ trễ phản hồi giao diện bằng 0).

2. **Cơ chế gửi Operation tuần tự (Single-In-Flight)**:
   - Để giữ luồng dữ liệu đơn giản và tránh nghẽn, Client chỉ gửi **duy nhất một** operation lên Server tại một thời điểm (`inFlightOp`).
   - Mọi chỉnh sửa tiếp theo của người dùng diễn ra trong lúc chờ xác nhận từ Server (chờ tín hiệu ACK) sẽ được tích lũy tạm thời bằng cách tính toán sự khác biệt chuỗi (String Diffing).
   - Khi nhận được tín hiệu ACK cho operation hiện tại, Client sẽ đóng gói và gửi operation tích lũy kế tiếp.

3. **Chuyển đổi hoạt động xung đột (Operational Transformation)**:
   - Nếu Client nhận được một remote operation từ người khác khi đang có operation đang chờ xử lý (`inFlightOp`):
     - Biến đổi remote op đối với local in-flight op: $op'_{remote} = transform(op_{remote}, op_{local\_inflight})$
     - Áp dụng $op'_{remote}$ vào editor hiện tại.
     - Biến đổi local in-flight op đối với remote op để chuẩn bị gửi tiếp: $op'_{local\_inflight} = transform(op_{local\_inflight}, op_{remote})$.

4. **Xử lý phía Server (Nguồn chân lý duy nhất)**:
   - Server tiếp nhận operation kèm chỉ số phiên bản làm căn cứ (`baseRevision`).
   - Nếu `baseRevision` khớp với `revision` hiện tại của tài liệu trên Server, Server sẽ áp dụng trực tiếp, tăng chỉ số revision và phát đi.
   - Nếu `baseRevision` nhỏ hơn chỉ số hiện tại (xảy ra xung đột đồng thời), Server sẽ lấy các operation đã áp dụng trong `opsLog` từ mốc `baseRevision` đến nay, chạy hàm biến đổi tuần tự (`transformSequence`) để cập nhật lại vị trí (`pos`) của operation mới nhận trước khi áp dụng vào tài liệu.

---

### 3. Giao thức trao đổi dữ liệu (Data Exchange Protocols)
Hệ thống kết hợp hài hòa giữa giao thức HTTP (REST API) cho việc tải dữ liệu tĩnh ban đầu và giao thức WebSocket (Socket.IO) cho việc tương tác thời gian thực.

#### 3.1. REST API (HTTP/JSON)
Dành cho việc quản lý tài liệu và các tác vụ phi thời gian thực:
- `GET /api/documents` : Lấy danh sách tài liệu hiện có của người dùng.
- `POST /api/documents` : Tạo một tài liệu mới (có hỗ trợ tạo từ các mẫu - templates có sẵn).
- `GET /api/documents/:id` : Lấy thông tin chi tiết của một tài liệu bao gồm tiêu đề, nội dung, phiên bản và quyền hạn của người dùng.
- `PUT /api/documents/:id` : Thay đổi tiêu đề của tài liệu.

#### 3.2. Giao thức WebSocket (Socket.IO Events)
Dành cho các hoạt động đồng bộ cộng tác thời gian thực:
- **Tín hiệu gửi đi từ Client (Client -> Server)**:
  - `join-document`: Gửi yêu cầu tham gia phòng soạn thảo tài liệu `{ documentId, username }`.
  - `submit-operation`: Gửi gói tin chỉnh sửa `{ documentId, op, clientId, baseRevision }`.
  - `cursor-move`: Đồng bộ vị trí con trỏ hiện tại `{ documentId, selStart, selEnd }`.
  - `leave-document`: Thông báo rời khỏi phòng soạn thảo.

- **Tín hiệu phát ra từ Server (Server -> Client)**:
  - `document-state`: Trả về trạng thái đầy đủ nhất của tài liệu khi người dùng vừa kết nối `{ title, content, revision, role }`.
  - `operation-ack`: Phản hồi xác nhận thành công thao tác gửi lên `{ appliedRevision, op }`.
  - `document-operation`: Phát tán thao tác đã xử lý xung đột tới tất cả các client khác `{ op, appliedRevision, clientId }`.
  - `active-users`: Cập nhật danh sách cộng tác viên đang trực tuyến `{ socketId, username, color, role }`.
  - `remote-cursor`: Đồng bộ vị trí con trỏ chuột của người dùng khác `{ socketId, username, color, selStart, selEnd }`.
  - `document-restored`: Thông báo tài liệu đã được khôi phục về phiên bản cũ thành công.

---

### 4. Thử nghiệm và Đánh giá (Testing and Evaluation)

#### 4.1. Kịch bản thử nghiệm (Test Scenarios)
- **Đồng biên tập song song**: Thử nghiệm giả lập 3 người dùng cùng truy cập vào một tài liệu và cùng gõ phím tại các dòng/vị trí ký tự khác nhau. Kết quả: Toàn bộ nội dung văn bản tự động dồn dòng và hiển thị đồng bộ tuyệt đối trên cả 3 trình duyệt.
- **Kiểm thử gõ phím nhanh đồng thời**: 2 người dùng cố tình chèn chữ vào cùng một vị trí ký tự tại cùng một thời điểm. Thuật toán OT giải quyết xung đột dựa vào ID của client (`clientId`) để phân xử thứ tự chèn trước sau, đảm bảo không bị chồng lấn ký tự.
- **Kiểm thử chế độ ngoại tuyến (Offline Resilience)**: Tắt mạng Internet của Client A, thực hiện một số chỉnh sửa trên Client A. Trong lúc đó, Client B vẫn trực tuyến và chỉnh sửa bình thường. Khi bật lại mạng của Client A, Client A tự động tính toán sai khác và thực hiện biến đổi (transform) các chỉnh sửa offline với nội dung mới nhất của Client B từ Server gửi về. Kết quả: Hai tài liệu nhập lại làm một một cách thông minh mà không bị đè đè mất dữ liệu.
- **Hệ thống Undo/Redo cộng tác**: Client A thực hiện Undo hành động gõ chữ của mình khi Client B vừa chèn thêm chữ ở vị trí trước đó. Giao diện Client A tự động tính toán vị trí lùi lại và chỉ hoàn tác đúng những ký tự do Client A đã gõ mà không can thiệp vào chữ của Client B.

#### 4.2. Đánh giá hiệu năng và Kết quả
- **Băng thông truyền tải**: Rất tối ưu. Thay vì truyền tải toàn bộ tài liệu (Document Content) sau mỗi phím gõ, hệ thống chỉ gửi một gói tin JSON có kích thước siêu nhỏ (chỉ khoảng 50 - 150 bytes) chứa thao tác cụ thể (ví dụ: Chèn chữ 'a' tại vị trí 10).
- **Trải nghiệm gõ phím**: Mượt mà. Do thao tác được áp dụng cục bộ lên giao diện ngay lập tức trước khi gửi đến Server, người soạn thảo hoàn toàn không có cảm giác bị gián đoạn hay trễ phím (Lag-free typing).
- **Tính nhất quán dữ liệu**: Khi tất cả người dùng dừng gõ, tài liệu trên tất cả Client hội tụ (convergence) về một phiên bản đồng nhất từ cấu trúc cho đến ký tự và định dạng. Dữ liệu trên cơ sở dữ liệu MongoDB trùng khớp 100% với trạng thái ở client.
