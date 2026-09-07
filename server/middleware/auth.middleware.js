const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const db = require('../database/connection');
const PresenceTracker = require('../utils/presence');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Không tìm thấy mã xác thực (Token missing)', code: 'NO_TOKEN' });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Mã xác thực không hợp lệ hoặc đã hết hạn', code: 'TOKEN_EXPIRED' });
    }

    // Đơn phiên (Single Session Enforcement): Kiểm tra xem sessionId trong JWT có khớp với DB không
    try {
      const dbUser = await db.getAsync('SELECT status, current_session_id FROM users WHERE id = ?', [user.id]);
      if (!dbUser) {
        return res.status(401).json({ error: 'Tài khoản không tồn tại trên hệ thống', code: 'USER_NOT_FOUND' });
      }
      if (dbUser.status === 'locked') {
        return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên!', code: 'ACCOUNT_LOCKED' });
      }
      if (dbUser.current_session_id && user.sessionId !== dbUser.current_session_id) {
        return res.status(401).json({ 
          error: 'Tài khoản của bạn đã được đăng nhập ở thiết bị khác. Hệ thống đã tự động đăng xuất khỏi phiên này để bảo mật!',
          code: 'SESSION_TAKEN_OVER'
        });
      }
    } catch (dbErr) {
      console.error('Session check error:', dbErr);
    }

    PresenceTracker.touch(user.id);
    req.user = user;
    next();
  });
}

module.exports = authenticateToken;

