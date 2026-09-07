const db = require('../database/connection');

const ReportRepository = {
  async findAll(filter = {}, user = null) {
    let sql = `
      SELECT r.*, 
             u.full_name as user_name, u.role as user_role, u.position as user_position,
             d.name as department_name, d.code as department_code,
             rev.full_name as reviewer_name
      FROM reports r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN users rev ON r.reviewer_id = rev.id
      WHERE 1=1
    `;
    const params = [];

    if (user && user.role === 'staff') {
      sql += ` AND r.user_id = ?`;
      params.push(user.id);
    } else if (user && user.role === 'manager') {
      sql += ` AND r.department_id = ?`;
      params.push(user.department_id);
    } else if (filter.department_id) {
      sql += ` AND r.department_id = ?`;
      params.push(filter.department_id);
    }

    if (filter.type) {
      sql += ` AND r.type = ?`;
      params.push(filter.type);
    }
    if (filter.status) {
      sql += ` AND r.status = ?`;
      params.push(filter.status);
    }

    sql += ` ORDER BY r.report_date DESC, r.created_at DESC`;
    return await db.allAsync(sql, params);
  },

  async findById(id) {
    return await db.getAsync('SELECT * FROM reports WHERE id = ?', [id]);
  },

  async create(data) {
    const res = await db.runAsync(`
      INSERT INTO reports (user_id, department_id, type, report_date, title, content_done, content_inprogress, content_issues, tasks_summary, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')
    `, [
      data.user_id, data.department_id, data.type, data.report_date,
      data.title, data.content_done, data.content_inprogress || null,
      data.content_issues || null, JSON.stringify(data.tasks_summary || [])
    ]);
    return res.lastID;
  },

  async review(id, reviewerId, status, reviewComment) {
    return await db.runAsync(`
      UPDATE reports
      SET status = ?, reviewer_id = ?, review_comment = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, reviewerId, reviewComment, id]);
  }
};

module.exports = ReportRepository;
