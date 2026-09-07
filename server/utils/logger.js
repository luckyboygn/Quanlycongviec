const db = require('../database/connection');

async function logActivity(userId, userName, action, entityType = null, entityId = null, details = null, ipAddress = null) {
  try {
    await db.runAsync(
      `INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, userName, action, entityType, entityId, details, ipAddress]
    );
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

async function createNotification(userId, title, content, type = 'info', relatedId = null) {
  try {
    await db.runAsync(
      `INSERT INTO notifications (user_id, title, content, type, related_id)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, title, content, type, relatedId]
    );
  } catch (err) {
    console.error('Error creating notification:', err);
  }
}

module.exports = {
  logActivity,
  createNotification
};
