const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const db = require('../database/connection');
const PresenceTracker = require('../utils/presence');

// In-memory session cache: key = userId, value = { status, current_session_id, cachedAt }
const userSessionCache = new Map();
const CACHE_TTL_MS = 10000; // 10 seconds TTL

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

    // Đơn phiên (Single Session Enforcement) với In-memory Cache giảm tải DB Cloud
    try {
      const now = Date.now();
      let dbUser = userSessionCache.get(user.id);
      if (!dbUser || (now - dbUser.cachedAt > CACHE_TTL_MS)) {
        const row = await db.getAsync('SELECT status, current_session_id FROM users WHERE id = ?', [user.id]);
        if (row) {
          dbUser = { status: row.status, current_session_id: row.current_session_id, cachedAt: now };
          userSessionCache.set(user.id, dbUser);
        } else {
          dbUser = null;
          userSessionCache.delete(user.id);
        }
      }

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

authenticateToken.invalidateCache = function(userId) {
  if (userId) userSessionCache.delete(userId);
  else userSessionCache.clear();
};

module.exports = authenticateToken;

