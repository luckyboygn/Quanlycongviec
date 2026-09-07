const bcrypt = require('bcryptjs');
const UserRepository = require('../repositories/user.repository');
const AuditRepository = require('../repositories/audit.repository');
const DepartmentRepository = require('../repositories/department.repository');
const { logActivity } = require('../utils/logger');

function extractValue(row, keys) {
  if (!row || typeof row !== 'object') return null;
  const rowKeys = Object.keys(row);
  for (const k of keys) {
    const kNorm = k.toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
    for (const rk of rowKeys) {
      const rkNorm = rk.toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
      if (kNorm === rkNorm && row[rk] !== undefined && row[rk] !== null && String(row[rk]).trim() !== '') {
        return String(row[rk]).trim();
      }
    }
  }
  return null;
}

function removeAccents(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .toLowerCase()
    .trim();
}

function generateUsernameFromName(fullName) {
  const clean = removeAccents(fullName);
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'user_' + Math.floor(1000 + Math.random() * 9000);
  if (words.length === 1) return words[0];
  // Example: "Nguyễn Văn An" -> "nguyenvanan"
  return words.join('');
}

function matchDepartment(deptStr, departments) {
  if (!deptStr) return null;
  const s = String(deptStr).toLowerCase().trim();
  const sClean = removeAccents(s);

  for (const d of departments) {
    const dName = d.name.toLowerCase();
    const dNameClean = removeAccents(d.name);
    const dCode = (d.code || '').toLowerCase();
    if (dName === s || dCode === s || dNameClean === sClean) return d.id;
    if (dName.includes(s) || s.includes(dName) || dNameClean.includes(sClean) || sClean.includes(dNameClean)) return d.id;
  }

  if (sClean.includes('ke toan') || sClean.includes('tai chinh') || sClean.includes('pkt')) {
    const d = departments.find(x => x.code === 'PKT' || x.name.includes('Kế toán'));
    if (d) return d.id;
  }
  if (sClean.includes('tong hop') || sClean.includes('hanh chinh') || sClean.includes('pth')) {
    const d = departments.find(x => x.code === 'PTH' || x.name.includes('Tổng hợp'));
    if (d) return d.id;
  }
  if (sClean.includes('dao tao') || sClean.includes('thu vien') || sClean.includes('qldt') || sClean.includes('quan ly dao tao')) {
    const d = departments.find(x => x.code === 'PQLDT' || x.name.includes('đào tạo') || x.name.includes('Đào tạo'));
    if (d) return d.id;
  }
  if (sClean.includes('nghien cuu') || sClean.includes('giang day') || sClean.includes('ncgd') || sClean.includes('khoa')) {
    const d = departments.find(x => x.code === 'PNCGD' || x.name.includes('Nghiên cứu'));
    if (d) return d.id;
  }
  if (sClean.includes('ke hoach') || sClean.includes('pkh')) {
    const d = departments.find(x => x.code === 'PKH' || x.name.includes('Kế hoạch'));
    if (d) return d.id;
  }
  return null;
}

function matchRole(roleStr, positionStr) {
  const r = removeAccents(String(roleStr || ''));
  const p = removeAccents(String(positionStr || ''));

  if (['admin', 'quan tri', 'quantri'].some(k => r.includes(k) || p.includes(k))) return 'admin';
  if (['director', 'giam doc', 'ban giam doc', 'bgd', 'hieu truong', 'pho hieu truong'].some(k => r.includes(k) || p.includes(k))) return 'director';
  if (['manager', 'truong phong', 'pho phong', 'chu nhiem', 'quan ly', 'pho truong phong', 'truong don vi', 'pho giam doc'].some(k => r.includes(k) || p.includes(k))) return 'manager';
  return 'staff';
}

function parseBirthDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const date = new Date((val - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  const s = String(val).trim();
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = String(dmyMatch[1]).padStart(2, '0');
    const month = String(dmyMatch[2]).padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }
  return s;
}

const AdminController = {
  async toggleUserStatus(req, res) {
    try {
      const userId = parseInt(req.params.id);
      if (userId === req.user.id) {
        return res.status(400).json({ error: 'Không thể tự khóa tài khoản của chính mình' });
      }

      const user = await UserRepository.findById(userId);
      if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

      const newStatus = (user.status === 'active') ? 'inactive' : 'active';
      await UserRepository.updateStatus(userId, newStatus);

      if (newStatus === 'inactive') {
        await UserRepository.updateSessionId(userId, null);
      }

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const actionText = newStatus === 'inactive' ? 'KHÓA_TÀI_KHOẢN' : 'MỞ_KHÓA_TÀI_KHOẢN';
      await logActivity(req.user.id, req.user.full_name, actionText, 'users', userId, `${actionText}: ${user.full_name} (@${user.username})`, clientIp);

      res.json({
        id: userId,
        status: newStatus,
        message: newStatus === 'inactive' ? 'Đã khóa tài khoản thành công' : 'Đã mở khóa tài khoản thành công'
      });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi thay đổi trạng thái tài khoản: ' + err.message });
    }
  },

  async batchImportUsers(req, res) {
    try {
      const { users } = req.body;
      if (!users || !Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ error: 'Danh sách nhân sự không hợp lệ hoặc rỗng' });
      }

      const departments = await DepartmentRepository.findAll();
      const results = { success: 0, failed: 0, created: 0, updated: 0, errors: [] };
      const usedUsernames = new Set();

      for (let i = 0; i < users.length; i++) {
        const item = users[i];
        if (!item || typeof item !== 'object') continue;

        try {
          // 1. Trích xuất Họ và tên
          const fullName = extractValue(item, [
            'full_name', 'fullName', 'Họ và tên', 'Họ tên', 'Họ và Tên', 'Ho va ten', 'Ho ten',
            'HỌ VÀ TÊN', 'HỌ TÊN', 'Tên cán bộ', 'Cán bộ', 'Họ và tên cán bộ', 'Họ và tên nhân sự', 'name'
          ]);

          // Bỏ qua dòng tiêu đề phụ hoặc dòng rỗng
          if (!fullName) {
            const hasAnyData = Object.values(item).some(v => v !== null && v !== undefined && String(v).trim() !== '');
            if (hasAnyData) {
              results.failed++;
              results.errors.push(`Dòng ${i + 1}: Thiếu thông tin Họ và tên`);
            }
            continue;
          }

          // Bỏ qua nếu dòng này là dòng tiêu đề hướng dẫn
          if (fullName.toUpperCase().includes('HƯỚNG DẪN') || fullName.toUpperCase().includes('QUY ĐỊNH') || fullName.toUpperCase().includes('CỘT THÔNG TIN')) {
            continue;
          }

          // 2. Trích xuất Mã cán bộ
          let empCode = extractValue(item, [
            'employee_code', 'employeeCode', 'Mã cán bộ', 'Mã CB', 'Mã nhân viên', 'Mã NV',
            'Ma can bo', 'Ma CB', 'MÃ CÁN BỘ', 'MÃ CB', 'code'
          ]);
          if (!empCode) {
            empCode = await UserRepository.getNextEmployeeCode();
          }

          // 3. Trích xuất hoặc Tự sinh Tên đăng nhập (Username)
          let rawUsername = extractValue(item, [
            'username', 'userName', 'Tên đăng nhập', 'Tài khoản', 'Ten dang nhap', 'Tai khoan',
            'TÊN ĐĂNG NHẬP', 'TÀI KHOẢN', 'user'
          ]);
          let finalUsername = rawUsername ? removeAccents(rawUsername).replace(/\s+/g, '') : generateUsernameFromName(fullName);
          
          // Tránh trùng username trong cùng 1 batch
          let uniqueUsername = finalUsername;
          let suffix = 1;
          while (usedUsernames.has(uniqueUsername)) {
            uniqueUsername = `${finalUsername}${suffix++}`;
          }
          usedUsernames.add(uniqueUsername);

          // 4. Trích xuất Phòng ban & Chức vụ & Quyền hạn
          const rawDept = extractValue(item, [
            'department_name', 'department', 'Phòng ban', 'Đơn vị', 'Phong ban', 'Don vi', 'PHÒNG BAN', 'ĐƠN VỊ'
          ]);
          const deptId = matchDepartment(rawDept, departments);

          const position = extractValue(item, [
            'position', 'Chức vụ', 'Chuc vu', 'CHỨC VỤ', 'Vị trí', 'Chức danh'
          ]) || 'Nhân viên';

          const rawRole = extractValue(item, [
            'role', 'Cấp phân quyền', 'Phân quyền', 'Cap phan quyen', 'Phan quyen', 'Vai trò', 'Vai tro', 'CẤP PHÂN QUYỀN'
          ]);
          const validRole = matchRole(rawRole, position);

          // 5. Mật khẩu
          const rawPassword = extractValue(item, ['password', 'Mật khẩu', 'Mat khau', 'MẬT KHẨU']) || '123456';
          const hashedPassword = await bcrypt.hash(rawPassword, 10);

          // 6. Các thông tin bổ sung (Email, Phone, Birth Date, Gender, Qualification)
          const email = extractValue(item, ['email', 'Email', 'Thư điện tử', 'EMAIL']);
          const phone = extractValue(item, ['phone', 'Số điện thoại', 'Điện thoại', 'So dien thoai', 'SĐT', 'SDT']);
          const birthDateRaw = extractValue(item, ['birth_date', 'birthDate', 'Ngày sinh', 'Ngay sinh', 'NGÀY SINH']);
          const birthDate = parseBirthDate(birthDateRaw);
          const gender = extractValue(item, ['gender', 'Giới tính', 'Gioi tinh', 'GIỚI TÍNH']) || 'Nam';
          const qualification = extractValue(item, ['qualification', 'Học vị', 'Trình độ', 'Hoc vi', 'Trinh do', 'HỌC VỊ']) || 'Đại học';

          // 7. Kiểm tra trùng lặp trong Database (theo employee_code hoặc username)
          let existingUser = null;
          if (empCode) {
            existingUser = await UserRepository.findByEmployeeCode(empCode);
          }
          if (!existingUser && uniqueUsername) {
            existingUser = await UserRepository.findByUsername(uniqueUsername);
          }

          if (existingUser) {
            // Cập nhật thông tin cán bộ đã tồn tại
            const updateFields = {
              full_name: fullName,
              role: validRole,
              status: 'active'
            };
            if (deptId) updateFields.department_id = deptId;
            if (position) updateFields.position = position;
            if (email) updateFields.email = email;
            if (phone) updateFields.phone = phone;
            if (birthDate) updateFields.birth_date = birthDate;
            if (gender) updateFields.gender = gender;
            if (qualification) updateFields.qualification = qualification;
            if (empCode) updateFields.employee_code = empCode;

            await UserRepository.update(existingUser.id, updateFields);
            results.success++;
            results.updated++;
          } else {
            // Tạo mới tài khoản cán bộ
            await UserRepository.create({
              employee_code: empCode,
              username: uniqueUsername,
              password: hashedPassword,
              full_name: fullName,
              email: email || null,
              phone: phone || null,
              role: validRole,
              department_id: deptId,
              position: position,
              birth_date: birthDate,
              gender: gender,
              qualification: qualification,
              avatar: null,
              status: 'active'
            });
            results.success++;
            results.created++;
          }

        } catch (itemErr) {
          results.failed++;
          results.errors.push(`Dòng ${i + 1}: ${itemErr.message}`);
        }
      }

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'BATCH_IMPORT_USERS', 'users', null, `Import thành công ${results.success} tài khoản (Tạo mới: ${results.created}, Cập nhật: ${results.updated}), Thất bại: ${results.failed}`, clientIp);

      let msg = `Đã import thành công ${results.success} cán bộ (Tạo mới: ${results.created}, Cập nhật: ${results.updated})`;
      if (results.failed > 0) {
        msg += ` - Thất bại: ${results.failed}`;
      }

      res.json({
        message: msg,
        results
      });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi import danh sách: ' + err.message });
    }
  },

  async getActivityLogs(req, res) {
    try {
      const logs = await AuditRepository.findAll(100);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi lấy nhật ký hoạt động' });
    }
  }
};

module.exports = AdminController;
