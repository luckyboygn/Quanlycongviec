const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const AuthService = require('../services/auth.service');
const UserRepository = require('../repositories/user.repository');

const AuthController = {
  async login(req, res) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
      }
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const result = await AuthService.login(username, password, clientIp);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async quickSwitch(req, res) {
    try {
      const { role, username, userId } = req.body;
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const result = await AuthService.quickSwitch({ role, username, userId }, clientIp);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async switchMyRole(req, res) {
    try {
      const { role, userId, username } = req.body;
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      let targetUserId = null;
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          if (decoded && decoded.id) {
            targetUserId = decoded.id;
          }
        } catch (e) {
          // Token expired or invalid
        }
      }

      if (!targetUserId && userId) {
        targetUserId = parseInt(userId);
      }

      if (!targetUserId && username) {
        const u = await UserRepository.findByUsername(username);
        if (u) targetUserId = u.id;
      }

      if (!targetUserId && req.user && req.user.id) {
        targetUserId = req.user.id;
      }

      if (!targetUserId) {
        const fallbackRes = await AuthService.quickSwitch({ role, username, userId }, clientIp);
        return res.json(fallbackRes);
      }

      const result = await AuthService.switchMyRole(targetUserId, role, clientIp);
      res.json(result);
    } catch (err) {
      try {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const fallbackResult = await AuthService.quickSwitch({ role: req.body?.role }, clientIp);
        return res.json(fallbackResult);
      } catch (e) {
        res.status(400).json({ error: err.message });
      }
    }
  },

  async getMe(req, res) {
    try {
      const user = await UserRepository.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
      res.json({ user });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi lấy thông tin người dùng' });
    }
  },

  async changePassword(req, res) {
    try {
      const { old_password, new_password, confirm_password } = req.body;
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const result = await AuthService.changePassword(req.user.id, old_password, new_password, confirm_password, clientIp);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
};

module.exports = AuthController;
