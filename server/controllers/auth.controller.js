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
  },

  getVersion(req, res) {
    try {
      let commit = 'fe9b200';
      let commitDate = '02/10/2026 10:25';
      let branch = 'main';

      try {
        const { execSync } = require('child_process');
        const gitCommit = execSync('git rev-parse --short HEAD').toString().trim();
        if (gitCommit) commit = gitCommit;

        const rawDate = execSync('git log -1 --format=%cd --date=iso').toString().trim();
        if (rawDate) {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            const hours = String(d.getHours()).padStart(2, '0');
            const mins = String(d.getMinutes()).padStart(2, '0');
            commitDate = `${day}/${month}/${year} ${hours}:${mins}`;
          }
        }
        const gitBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
        if (gitBranch) branch = gitBranch;
      } catch (e) {
        try {
          const vFile = require('../../version.json');
          if (vFile.commit) commit = vFile.commit;
          if (vFile.commitDate) commitDate = vFile.commitDate;
          if (vFile.branch) branch = vFile.branch;
        } catch (err) {}
      }

      res.json({
        commit,
        commitDate,
        branch,
        version: '2.5.0'
      });
    } catch (err) {
      res.json({
        commit: 'fe9b200',
        commitDate: '02/10/2026 10:25',
        branch: 'main',
        version: '2.5.0'
      });
    }
  }
};

module.exports = AuthController;
