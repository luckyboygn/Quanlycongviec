const db = require('../database/connection');

const AuditRepository = {
  async findAll(limit = 100) {
    return await db.allAsync(`
      SELECT * FROM activity_logs
      ORDER BY created_at DESC
      LIMIT ?
    `, [limit]);
  }
};

module.exports = AuditRepository;
