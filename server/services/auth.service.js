const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/constants');
const UserRepository = require('../repositories/user.repository');
const { logActivity } = require('../utils/logger');

const AuthService = {
  async login(username, password, clientIp) {
    if (!username || !password) {
      throw new Error('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu');
    }
    const cleanUsername = String(username).trim();
    let user = await UserRepository.findByUsername(cleanUsername);
    if (!user) {
      user = await UserRepository.findByEmployeeCode(cleanUsername);
    }
    if (!user) {
      throw new Error('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    if (user.status === 'locked') {
      throw new Error('Tài khoản đã bị khóa. Vui lòng liên hệ Quản trị viên!');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    const sessionId = crypto.randomBytes(16).toString('hex');
    await UserRepository.updateSessionId(user.id, sessionId);

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        department_id: user.department_id,
        department_name: user.department_name,
        department_code: user.department_code,
        full_name: user.full_name,
        sessionId: sessionId
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    await logActivity(user.id, user.full_name, 'LOGIN', 'auth', user.id, 'Đăng nhập thành công', clientIp);

    const userProfile = { ...user };
    delete userProfile.password;
    delete userProfile.current_session_id;

    return { token, user: userProfile };
  },

  async quickSwitch(params, clientIp) {
    let user;
    if (params && typeof params === 'object') {
      const { userId, username, role } = params;
      if (userId && role && ['admin', 'director', 'manager', 'staff'].includes(role)) {
        await UserRepository.update(parseInt(userId), { role });
        user = await UserRepository.findById(parseInt(userId));
      } else if (userId) {
        user = await UserRepository.findById(parseInt(userId));
      } else if (username && role && ['admin', 'director', 'manager', 'staff'].includes(role)) {
        const u = await UserRepository.findByUsername(username);
        if (u) {
          await UserRepository.update(u.id, { role });
          user = await UserRepository.findById(u.id);
        }
      } else if (username) {
        user = await UserRepository.findByUsername(username);
      } else if (role) {
        const users = await UserRepository.findAll();
        user = users.find(u => u.role === role && u.status !== 'locked');
        if (!user && role === 'admin') {
          const adminUser = await UserRepository.findByUsername('admin');
          if (adminUser) {
            await UserRepository.update(adminUser.id, { role: 'admin' });
            user = await UserRepository.findById(adminUser.id);
          }
        }
      }
    } else if (typeof params === 'number' || (!isNaN(params) && typeof params === 'string' && Number.isInteger(Number(params)))) {
      user = await UserRepository.findById(parseInt(params));
    } else if (['admin', 'director', 'manager', 'staff'].includes(params)) {
      const users = await UserRepository.findAll();
      user = users.find(u => u.role === params && u.status !== 'locked');
      if (!user && params === 'admin') {
        const adminUser = await UserRepository.findByUsername('admin');
        if (adminUser) {
          await UserRepository.update(adminUser.id, { role: 'admin' });
          user = await UserRepository.findById(adminUser.id);
        }
      }
    } else if (typeof params === 'string') {
      user = await UserRepository.findByUsername(params);
    }

    if (!user) {
      throw new Error('Không tìm thấy tài khoản người dùng tương ứng');
    }

    const sessionId = crypto.randomBytes(16).toString('hex');
    await UserRepository.updateSessionId(user.id, sessionId);

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        department_id: user.department_id,
        department_name: user.department_name,
        department_code: user.department_code,
        full_name: user.full_name,
        sessionId: sessionId
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    await logActivity(user.id, user.full_name, 'QUICK_SWITCH', 'auth', user.id, `Chuyển đổi sang vai trò: ${user.role}`, clientIp);

    const userProfile = { ...user };
    delete userProfile.password;
    delete userProfile.current_session_id;

    return { token, user: userProfile };
  },

  async switchMyRole(userId, newRole, clientIp) {
    if (!['admin', 'director', 'manager', 'staff'].includes(newRole)) {
      throw new Error('Vai trò không hợp lệ');
    }

    await UserRepository.update(userId, { role: newRole });
    const user = await UserRepository.findById(userId);

    const sessionId = crypto.randomBytes(16).toString('hex');
    await UserRepository.updateSessionId(user.id, sessionId);

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        department_id: user.department_id,
        department_name: user.department_name,
        department_code: user.department_code,
        full_name: user.full_name,
        sessionId: sessionId
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    await logActivity(user.id, user.full_name, 'SWITCH_MY_ROLE', 'users', user.id, `Tự chuyển cấp quyền sang: ${newRole}`, clientIp);

    const userProfile = { ...user };
    delete userProfile.password;

    return { token, user: userProfile };
  },

  async changePassword(userId, oldPassword, newPassword, confirmPassword, clientIp) {
    if (!oldPassword || !newPassword) {
      throw new Error('Vui lòng nhập mật khẩu cũ và mật khẩu mới');
    }
    if (newPassword.length < 6) {
      throw new Error('Mật khẩu mới phải có tối thiểu 6 ký tự');
    }
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      throw new Error('Xác nhận mật khẩu mới không trùng khớp');
    }
    if (oldPassword === newPassword) {
      throw new Error('Mật khẩu mới không được trùng với mật khẩu hiện tại');
    }

    const user = await UserRepository.findByIdWithPassword(userId);
    if (!user) {
      throw new Error('Không tìm thấy thông tin tài khoản người dùng');
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new Error('Mật khẩu hiện tại (mật khẩu cũ) không chính xác');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await UserRepository.updatePassword(userId, hashedPassword);

    await logActivity(userId, user.full_name, 'CHANGE_PASSWORD', 'users', userId, 'Đổi mật khẩu tài khoản thành công', clientIp);

    return { success: true, message: 'Đổi mật khẩu thành công! Vui lòng ghi nhớ mật khẩu mới cho các lần đăng nhập tiếp theo.' };
  }
};

module.exports = AuthService;
