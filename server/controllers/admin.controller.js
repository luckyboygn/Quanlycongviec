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
  },

  async exportBackup(req, res) {
    try {
      const db = require('../database/connection');

      const departments = await db.allAsync('SELECT * FROM departments ORDER BY id ASC');
      const users = await db.allAsync('SELECT * FROM users ORDER BY id ASC');
      const tasks = await db.allAsync('SELECT * FROM tasks ORDER BY id ASC');
      const task_assignees = await db.allAsync('SELECT * FROM task_assignees ORDER BY task_id, user_id ASC');
      const task_logs = await db.allAsync('SELECT * FROM task_logs ORDER BY id ASC');
      const reports = await db.allAsync('SELECT * FROM reports ORDER BY id ASC');
      const personal_work_logs = await db.allAsync('SELECT * FROM personal_work_logs ORDER BY id ASC');
      const messages = await db.allAsync('SELECT * FROM messages ORDER BY id ASC');
      const notifications = await db.allAsync('SELECT * FROM notifications ORDER BY id ASC');
      const news = await db.allAsync('SELECT * FROM news ORDER BY id ASC');
      const activity_logs = await db.allAsync('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 500');

      const nowStr = new Date().toISOString();
      const backupData = {
        app_name: 'Theo dõi công việc - Trường Đào tạo cán bộ Agribank',
        version: '2.0.0',
        exported_at: nowStr,
        exported_by: {
          id: req.user.id,
          username: req.user.username,
          full_name: req.user.full_name
        },
        stats: {
          departments: departments.length,
          users: users.length,
          tasks: tasks.length,
          task_assignees: task_assignees.length,
          task_logs: task_logs.length,
          reports: reports.length,
          personal_work_logs: personal_work_logs.length,
          messages: messages.length,
          notifications: notifications.length,
          news: news.length,
          activity_logs: activity_logs.length
        },
        data: {
          departments,
          users,
          tasks,
          task_assignees,
          task_logs,
          reports,
          personal_work_logs,
          messages,
          notifications,
          news,
          activity_logs
        }
      };

      const dateTag = new Date().toISOString().replace(/[:\.]/g, '-').slice(0, 19);
      const filename = `Backup_TheoDoiCV_Agribank_${dateTag}.json`;

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'EXPORT_BACKUP', 'system', null, `Tải về bản sao lưu toàn bộ hệ thống (${users.length} người dùng, ${tasks.length} việc, ${personal_work_logs.length} nhật ký)`, clientIp);

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(JSON.stringify(backupData, null, 2));
    } catch (err) {
      console.error('Export backup error:', err);
      res.status(500).json({ error: 'Lỗi xuất file sao lưu hệ thống: ' + err.message });
    }
  },

  async restoreBackup(req, res) {
    try {
      const db = require('../database/connection');
      const payload = req.body;

      if (!payload || !payload.data) {
        return res.status(400).json({ error: 'Tệp sao lưu không hợp lệ hoặc thiếu dữ liệu (Thiếu trường data)' });
      }

      const { data, stats, exported_at } = payload;

      // 1. Xóa sạch các bảng theo thứ tự quan hệ khóa ngoại (Foreign Key Safe Order)
      await db.runAsync('DELETE FROM messages');
      await db.runAsync('DELETE FROM notifications');
      await db.runAsync('DELETE FROM task_assignees');
      await db.runAsync('DELETE FROM task_logs');
      await db.runAsync('DELETE FROM personal_work_logs');
      await db.runAsync('DELETE FROM reports');
      await db.runAsync('DELETE FROM tasks');
      await db.runAsync('DELETE FROM users');
      await db.runAsync('DELETE FROM departments');
      await db.runAsync('DELETE FROM news');

      // 2. Phục hồi Departments
      if (data.departments && data.departments.length > 0) {
        for (const d of data.departments) {
          await db.runAsync(
            `INSERT INTO departments (id, name, code, description, created_at) VALUES (?, ?, ?, ?, ?)`,
            [d.id, d.name, d.code, d.description || null, d.created_at || new Date().toISOString()]
          );
        }
        if (db.isPostgres) {
          try { await db.runAsync(`SELECT setval('departments_id_seq', (SELECT COALESCE(MAX(id), 1) FROM departments))`); } catch (e) {}
        }
      }

      // 3. Phục hồi Users
      if (data.users && data.users.length > 0) {
        for (const u of data.users) {
          const birthDate = (u.birth_date && String(u.birth_date).trim() !== '') ? String(u.birth_date).trim() : null;
          await db.runAsync(
            `INSERT INTO users (id, employee_code, username, password, full_name, email, phone, role, department_id, position, birth_date, gender, qualification, avatar, status, current_session_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              u.id, u.employee_code || null, u.username, u.password, u.full_name, u.email || null, u.phone || null,
              u.role, u.department_id || null, u.position || null, birthDate, u.gender || 'Nam',
              u.qualification || 'Đại học', u.avatar || null, u.status || 'active', u.current_session_id || null, u.created_at || new Date().toISOString()
            ]
          );
        }
        if (db.isPostgres) {
          try { await db.runAsync(`SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users))`); } catch (e) {}
        }
      }

      // 4. Phục hồi Tasks
      if (data.tasks && data.tasks.length > 0) {
        for (const t of data.tasks) {
          await db.runAsync(
            `INSERT INTO tasks (id, title, description, department_id, created_by, priority, status, progress, start_date, due_date, completed_at, attachment_links, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              t.id, t.title, t.description || null, t.department_id || null, t.created_by || null,
              t.priority || 'medium', t.status || 'pending', t.progress || 0,
              t.start_date, t.due_date, t.completed_at || null, t.attachment_links || null,
              t.created_at || new Date().toISOString(), t.updated_at || new Date().toISOString()
            ]
          );
        }
        if (db.isPostgres) {
          try { await db.runAsync(`SELECT setval('tasks_id_seq', (SELECT COALESCE(MAX(id), 1) FROM tasks))`); } catch (e) {}
        }
      }

      // 5. Phục hồi Task Assignees
      if (data.task_assignees && data.task_assignees.length > 0) {
        for (const a of data.task_assignees) {
          await db.runAsync(
            `INSERT INTO task_assignees (task_id, user_id, is_leader) VALUES (?, ?, ?)`,
            [a.task_id, a.user_id, a.is_leader || 0]
          );
        }
      }

      // 6. Phục hồi Task Logs
      if (data.task_logs && data.task_logs.length > 0) {
        for (const l of data.task_logs) {
          await db.runAsync(
            `INSERT INTO task_logs (id, task_id, user_id, log_date, progress_percent, note, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [l.id, l.task_id, l.user_id, l.log_date, l.progress_percent || null, l.note, l.created_at || new Date().toISOString()]
          );
        }
        if (db.isPostgres) {
          try { await db.runAsync(`SELECT setval('task_logs_id_seq', (SELECT COALESCE(MAX(id), 1) FROM task_logs))`); } catch (e) {}
        }
      }

      // 7. Phục hồi Reports
      if (data.reports && data.reports.length > 0) {
        for (const r of data.reports) {
          await db.runAsync(
            `INSERT INTO reports (id, user_id, department_id, type, report_date, title, content_done, content_inprogress, content_issues, tasks_summary, status, reviewer_id, review_comment, reviewed_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              r.id, r.user_id, r.department_id || null, r.type || 'daily', r.report_date, r.title,
              r.content_done || '', r.content_inprogress || null, r.content_issues || null, r.tasks_summary || null,
              r.status || 'submitted', r.reviewer_id || null, r.review_comment || null, r.reviewed_at || null, r.created_at || new Date().toISOString()
            ]
          );
        }
        if (db.isPostgres) {
          try { await db.runAsync(`SELECT setval('reports_id_seq', (SELECT COALESCE(MAX(id), 1) FROM reports))`); } catch (e) {}
        }
      }

      // 8. Phục hồi Personal Work Logs
      if (data.personal_work_logs && data.personal_work_logs.length > 0) {
        for (const p of data.personal_work_logs) {
          await db.runAsync(
            `INSERT INTO personal_work_logs (id, user_id, department_id, task_id, task_name, title, activity_type, start_date, end_date, start_time, end_time, hours_spent, location, description, result_outcome, attachment_url, status, auto_complete, completed_at, approval_status, approved_by, approved_at, approval_comment, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              p.id, p.user_id, p.department_id || null, p.task_id || null, p.task_name || null, p.title,
              p.activity_type || 'Công tác chuyên môn', p.start_date, p.end_date, p.start_time || null, p.end_time || null,
              p.hours_spent || 8.0, p.location || 'Tại Trường ĐT CB Agribank', p.description || '', p.result_outcome || null,
              p.attachment_url || null, p.status || 'in_progress', p.auto_complete !== undefined ? p.auto_complete : 1, p.completed_at || null,
              p.approval_status || 'pending', p.approved_by || null, p.approved_at || null, p.approval_comment || null,
              p.created_at || new Date().toISOString(), p.updated_at || new Date().toISOString()
            ]
          );
        }
        if (db.isPostgres) {
          try { await db.runAsync(`SELECT setval('personal_work_logs_id_seq', (SELECT COALESCE(MAX(id), 1) FROM personal_work_logs))`); } catch (e) {}
        }
      }

      // 9. Phục hồi Messages
      if (data.messages && data.messages.length > 0) {
        for (const m of data.messages) {
          await db.runAsync(
            `INSERT INTO messages (id, sender_id, receiver_id, channel, content, attachment_url, attachment_name, is_read, is_recalled, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              m.id, m.sender_id, m.receiver_id || null, m.channel || 'direct', m.content || '',
              m.attachment_url || null, m.attachment_name || null, m.is_read || 0, m.is_recalled || 0, m.created_at || new Date().toISOString()
            ]
          );
        }
        if (db.isPostgres) {
          try { await db.runAsync(`SELECT setval('messages_id_seq', (SELECT COALESCE(MAX(id), 1) FROM messages))`); } catch (e) {}
        }
      }

      // 10. Phục hồi Notifications
      if (data.notifications && data.notifications.length > 0) {
        for (const n of data.notifications) {
          await db.runAsync(
            `INSERT INTO notifications (id, user_id, title, content, type, related_id, is_read, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [n.id, n.user_id, n.title, n.content, n.type || 'info', n.related_id || null, n.is_read || 0, n.created_at || new Date().toISOString()]
          );
        }
        if (db.isPostgres) {
          try { await db.runAsync(`SELECT setval('notifications_id_seq', (SELECT COALESCE(MAX(id), 1) FROM notifications))`); } catch (e) {}
        }
      }

      // 11. Phục hồi News
      if (data.news && data.news.length > 0) {
        for (const nw of data.news) {
          await db.runAsync(
            `INSERT INTO news (id, title, content, summary, category, badge_color, author_id, author_name, is_pinned, image_url, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              nw.id, nw.title, nw.content, nw.summary || null, nw.category || 'Thông báo', nw.badge_color || 'emerald',
              nw.author_id || null, nw.author_name || null, nw.is_pinned || 0, nw.image_url || null,
              nw.created_at || new Date().toISOString(), nw.updated_at || new Date().toISOString()
            ]
          );
        }
        if (db.isPostgres) {
          try { await db.runAsync(`SELECT setval('news_id_seq', (SELECT COALESCE(MAX(id), 1) FROM news))`); } catch (e) {}
        }
      }

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'RESTORE_BACKUP', 'system', null, `Đã khôi phục toàn bộ hệ thống từ bản sao lưu ngày ${exported_at || 'trước đó'} (${data.users?.length || 0} cán bộ, ${data.tasks?.length || 0} công việc, ${data.personal_work_logs?.length || 0} nhật ký)`, clientIp);

      res.json({
        success: true,
        message: 'Khôi phục toàn bộ hệ thống từ tệp sao lưu thành công!',
        restored_counts: {
          departments: data.departments?.length || 0,
          users: data.users?.length || 0,
          tasks: data.tasks?.length || 0,
          personal_work_logs: data.personal_work_logs?.length || 0,
          messages: data.messages?.length || 0,
          reports: data.reports?.length || 0,
          news: data.news?.length || 0
        }
      });
    } catch (err) {
      console.error('Restore backup error:', err);
      res.status(500).json({ error: 'Lỗi khôi phục hệ thống: ' + err.message });
    }
  }
};

module.exports = AdminController;
