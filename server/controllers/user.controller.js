const bcrypt = require('bcryptjs');
const UserRepository = require('../repositories/user.repository');
const { logActivity } = require('../utils/logger');

const UserController = {
  async getAll(req, res) {
    try {
      const users = await UserRepository.findAll();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi lấy danh sách nhân sự' });
    }
  },

  async create(req, res) {
    try {
      const { employee_code, username, password, full_name, email, phone, role, department_id, position, birth_date, gender, qualification } = req.body;
      if (!username || !password || !full_name || !role) {
        return res.status(400).json({ error: 'Vui lòng nhập đầy đủ các trường bắt buộc' });
      }

      const existing = await UserRepository.findByUsername(username);
      if (existing) {
        return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại trên hệ thống' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const resId = await UserRepository.create({
        employee_code: employee_code ? employee_code.trim() : null,
        username, password: hashedPassword, full_name, email, phone,
        role, department_id, position, birth_date, gender, qualification
      });

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'CREATE_USER', 'users', resId.lastID, `Tạo tài khoản: ${full_name} (@${username})`, clientIp);

      const newUser = await UserRepository.findById(resId.lastID);
      res.status(201).json(newUser);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi tạo tài khoản nhân sự: ' + err.message });
    }
  },

  async update(req, res) {
    try {
      const targetId = parseInt(req.params.id);
      const isSelf = req.user.id === targetId;
      const isAdmin = req.user.role === 'admin';

      if (!isSelf && !isAdmin) {
        return res.status(403).json({ error: 'Bạn chỉ có quyền cập nhật thông tin của chính mình' });
      }

      const { employee_code, full_name, email, phone, department_id, position, birth_date, gender, qualification, avatar, role, status, password, username } = req.body;

      const updateFields = {};
      if (employee_code !== undefined) updateFields.employee_code = employee_code ? employee_code.trim() : null;
      if (full_name !== undefined) updateFields.full_name = full_name;
      if (email !== undefined) updateFields.email = email;
      if (phone !== undefined) updateFields.phone = phone;
      if (position !== undefined) updateFields.position = position;
      if (birth_date !== undefined) updateFields.birth_date = birth_date;
      if (gender !== undefined) updateFields.gender = gender;
      if (qualification !== undefined) updateFields.qualification = qualification;
      if (avatar !== undefined) updateFields.avatar = avatar;

      if (isAdmin) {
        if (department_id !== undefined) updateFields.department_id = department_id || null;
        if (role !== undefined) updateFields.role = role;
        if (status !== undefined) updateFields.status = status;
        if (username !== undefined && username.trim()) updateFields.username = username.trim();
        if (password && password.trim()) {
          updateFields.password = await bcrypt.hash(password.trim(), 10);
        }
      }

      if (Object.keys(updateFields).length > 0) {
        await UserRepository.update(targetId, updateFields);
      }

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'UPDATE_USER', 'users', targetId, `Cập nhật hồ sơ tài khoản ID: ${targetId}`, clientIp);

      const updatedUser = await UserRepository.findById(targetId);
      res.json(updatedUser);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi cập nhật thông tin: ' + err.message });
    }
  },

  async changeRole(req, res) {
    try {
      const targetId = parseInt(req.params.id);
      const { role } = req.body;
      const validRoles = ['director', 'admin', 'manager', 'staff'];

      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ error: 'Cấp phân quyền không hợp lệ. Cho phép: director, admin, manager, staff' });
      }

      const targetUser = await UserRepository.findById(targetId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Không tìm thấy người dùng' });
      }

      await UserRepository.update(targetId, { role });

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'CHANGE_USER_ROLE', 'users', targetId, `Chuyển phân quyền cán bộ ${targetUser.full_name} (@${targetUser.username}) sang ${role}`, clientIp);

      let token = null;
      if (targetId === req.user.id) {
        const { JWT_SECRET } = require('../config/constants');
        const jwt = require('jsonwebtoken');
        token = jwt.sign(
          { id: targetUser.id, username: targetUser.username, role, full_name: targetUser.full_name, department_id: targetUser.department_id, sessionId: req.user.sessionId },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
      }

      res.json({
        message: 'Cập nhật phân quyền thành công',
        user: { ...targetUser, role },
        token
      });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi cập nhật phân quyền: ' + err.message });
    }
  },

  async changePosition(req, res) {
    try {
      const targetId = parseInt(req.params.id);
      const { position } = req.body;

      const targetUser = await UserRepository.findById(targetId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Không tìm thấy người dùng' });
      }

      await UserRepository.update(targetId, { position: position || null });

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'CHANGE_USER_POSITION', 'users', targetId, `Cập nhật chức vụ cán bộ ${targetUser.full_name} (@${targetUser.username}) thành: ${position}`, clientIp);

      res.json({
        message: 'Cập nhật chức vụ thành công',
        user: { ...targetUser, position }
      });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi cập nhật chức vụ: ' + err.message });
    }
  },

  async changeDepartment(req, res) {
    try {
      const targetId = parseInt(req.params.id);
      const { department_id } = req.body;
      const deptId = department_id ? parseInt(department_id) : null;

      const targetUser = await UserRepository.findById(targetId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Không tìm thấy người dùng' });
      }

      await UserRepository.update(targetId, { department_id: deptId });

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'CHANGE_USER_DEPARTMENT', 'users', targetId, `Chuyển phòng ban cán bộ ${targetUser.full_name} sang phòng ID: ${deptId || 'Ban Giám đốc'}`, clientIp);

      const updatedUser = await UserRepository.findById(targetId);
      res.json({
        message: 'Cập nhật phòng ban thành công',
        user: updatedUser
      });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi cập nhật phòng ban: ' + err.message });
    }
  },

  async resetPassword(req, res) {
    try {
      const targetId = parseInt(req.params.id);
      const { username, new_password } = req.body;
      if (!new_password || new_password.length < 6) {
        return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
      }

      const targetUser = await UserRepository.findById(targetId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Không tìm thấy người dùng' });
      }

      const updateFields = {
        password: await bcrypt.hash(new_password, 10)
      };

      if (username && username.trim() && username.trim() !== targetUser.username) {
        const existing = await UserRepository.findByUsername(username.trim());
        if (existing && existing.id !== targetId) {
          return res.status(400).json({ error: 'Tên đăng nhập mới đã tồn tại trên hệ thống' });
        }
        updateFields.username = username.trim();
      }

      await UserRepository.update(targetId, updateFields);

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'RESET_PASSWORD', 'users', targetId, `Đổi thông tin đăng nhập/mật khẩu cho cán bộ ${targetUser.full_name} (ID: ${targetId})`, clientIp);

      let token = null;
      if (targetId === req.user.id) {
        const { JWT_SECRET } = require('../config/constants');
        const jwt = require('jsonwebtoken');
        token = jwt.sign(
          { id: targetUser.id, username: updateFields.username || targetUser.username, role: targetUser.role, full_name: targetUser.full_name, department_id: targetUser.department_id, sessionId: req.user.sessionId },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
      }

      res.json({ message: 'Đổi thông tin đăng nhập & mật khẩu thành công!', token });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi cấp lại mật khẩu: ' + err.message });
    }
  },

  async delete(req, res) {
    try {
      const targetId = parseInt(req.params.id);
      if (targetId === req.user.id) {
        return res.status(400).json({ error: 'Không thể tự xóa tài khoản của chính mình' });
      }

      await UserRepository.delete(targetId);
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'DELETE_USER', 'users', targetId, `Xóa tài khoản ID: ${targetId}`, clientIp);

      res.json({ message: 'Đã xóa tài khoản thành công' });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi xóa tài khoản' });
    }
  }
};

module.exports = UserController;
