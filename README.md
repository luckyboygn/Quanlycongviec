# Hệ thống Theo dõi & Quản lý Công việc - Trường Đào tạo cán bộ Agribank

Hệ thống quản lý công việc và báo cáo tiến độ theo **4 cấp độ phân quyền** tại Trường Đào tạo cán bộ Agribank.

---

## 🎭 Cơ cấu Phân quyền 4 Cấp (Role-Based Access Control)

| Cấp vai trò | Tên đăng nhập | Họ và tên | Chức vụ | Quyền hạn chính |
| :--- | :--- | :--- | :--- | :--- |
| **🏛️ 1. Ban Giám đốc** | `bgd_hung` | TS. Nguyễn Văn Hùng | Hiệu trưởng | **Full chức năng điều hành toàn trường** (Xem & chỉ đạo 5 phòng, giao việc, duyệt báo cáo). *Ẩn menu Quản trị user/audit.* |
| **🏛️ 1. Ban Giám đốc** | `bgd_minh` | ThS. Trần Văn Minh | Phó Hiệu trưởng | Điều hành, đôn đốc tiến độ 5 phòng |
| **👑 2. Admin Quản trị** | `admin` | Trần Thị Mai Lan | Phòng Tổng hợp | **Quản trị hệ thống**: Tạo mới người dùng, đặt lại mật khẩu, phân quyền 5 phòng, cấu hình hệ thống & xem Audit Log |
| **⭐ 3. Cấp Trưởng phòng** | `tp_qldt` | ThS. Lê Hoàng Nam | Trưởng phòng QLĐT & Thư viện | Giao việc cho nhân viên phòng mình, quản lý tiến độ phòng, phê duyệt & nhận xét báo cáo |
| **⭐ 3. Cấp Trưởng phòng** | `tp_ncgd` | PGS.TS. Đặng Quốc Bảo | Trưởng phòng Nghiên cứu - Giảng dạy | Quản lý tiến độ giảng dạy, duyệt báo cáo khoa học |
| **⭐ 3. Cấp Trưởng phòng** | `tp_kt` | Nguyễn Thị Thu Trang | Trưởng phòng Kế toán | Quản lý công việc tài chính, kế toán |
| **⭐ 3. Cấp Trưởng phòng** | `tp_kh` | Vũ Đức Thịnh | Trưởng phòng Kế hoạch | Quản lý kế hoạch và chỉ tiêu đào tạo |
| **👤 4. Giảng viên / NV** | `gv_minh` | ThS. Phạm Quang Minh | Giảng viên NCGD | Xem việc được giao, kéo thanh tiến độ %, ghi log ngày, nộp báo cáo |
| **👤 4. Giảng viên / NV** | `nv_hoa` | Nguyễn Thị Thu Hòa | Chuyên viên QLĐT & TV | Thực hiện công việc lớp học |
| **👤 4. Giảng viên / NV** | `nv_tuan` | Bùi Anh Tuấn | Chuyên viên Kế hoạch | Thực hiện kế hoạch đào tạo |
| **👤 4. Giảng viên / NV** | `nv_linh` | Đỗ Thùy Linh | Kế toán viên | Cập nhật tiến độ thanh toán |

*(Mật khẩu mặc định cho tất cả tài khoản: `123456`)*

---

## 🏛️ Cơ cấu 5 Phòng Ban của Trường
1. **Phòng Kế toán (PKT)**
2. **Phòng Tổng hợp (PTH)**
3. **Phòng Quản lý đào tạo và Thư viện (QLDT-TV)**
4. **Phòng Kế hoạch (PKH)**
5. **Phòng Nghiên cứu - Giảng dạy (NCGD)**

---

## 🚀 Khởi chạy Ứng dụng
```bash
npm start
```
Truy cập ngay trên trình duyệt:
👉 **[http://localhost:3000](http://localhost:3000)**
