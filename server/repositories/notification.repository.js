const db = require('../database/connection');

const NotificationRepository = {
  async findByUserId(userId, limit = 50) {
    return await db.allAsync(`
      SELECT * FROM notifications 
      WHERE user_id = ?
      ORDER BY created_at DESC 
      LIMIT ?
    `, [userId, limit]);
  },

  async markAsRead(id, userId) {
    return await db.runAsync('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
  },

  async markAllAsRead(userId) {
    return await db.runAsync('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
  },

  async create({ user_id, title, content, type = 'info', related_id = null }) {
    return await db.runAsync(`
      INSERT INTO notifications (user_id, title, content, type, related_id)
      VALUES (?, ?, ?, ?, ?)
    `, [user_id, title, content, type, related_id]);
  }
};

module.exports = NotificationRepository;
