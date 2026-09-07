const db = require('../database/connection');

const DiaryRepository = {
  async checkAndAutoCompleteLogs() {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;

      await db.runAsync(`
        UPDATE personal_work_logs
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE status = 'in_progress' AND auto_complete = 1 AND (
          end_date < ? OR (end_date = ? AND end_time IS NOT NULL AND end_time <= ?)
        )
      `, [today, today, currentTime]);
    } catch (err) {
      console.error('Error auto completing personal logs:', err);
    }
  },

  async findAll(filter = {}, user = null) {
    // Run auto complete check first
    await this.checkAndAutoCompleteLogs();

    let sql = `
      SELECT pwl.*, 
             u.full_name as user_name, u.role as user_role, u.position as user_position, u.employee_code,
             d.name as department_name, d.code as department_code,
             t.title as ref_task_title,
             appr.full_name as approved_by_name,
             sup.full_name as supervisor_name, sup.position as supervisor_position, sup.role as supervisor_role
      FROM personal_work_logs pwl
      JOIN users u ON pwl.user_id = u.id
      LEFT JOIN departments d ON pwl.department_id = d.id
      LEFT JOIN tasks t ON pwl.task_id = t.id
      LEFT JOIN users appr ON pwl.approved_by = appr.id
      LEFT JOIN users sup ON pwl.supervisor_id = sup.id
      WHERE 1=1
    `;
    const params = [];

    const isDirectorOrAdmin = user && (user.role === 'director' || user.role === 'admin');

    if (filter.supervisor_id) {
      sql += ` AND pwl.supervisor_id = ?`;
      params.push(filter.supervisor_id);
    } else if (isDirectorOrAdmin) {
      if (filter.department_id) {
        sql += ` AND pwl.department_id = ?`;
        params.push(filter.department_id);
      }
    } else if (user && user.role === 'staff') {
      sql += ` AND pwl.user_id = ?`;
      params.push(user.id);
    } else if (user && user.role === 'manager') {
      const targetDept = filter.department_id || user.department_id;
      if (targetDept) {
        sql += ` AND (pwl.department_id = ? OR pwl.supervisor_id = ?)`;
        params.push(targetDept, user.id);
      }
    } else if (filter.department_id) {
      sql += ` AND pwl.department_id = ?`;
      params.push(filter.department_id);
    }

    if (filter.user_id && filter.user_id !== 'all') {
      sql += ` AND pwl.user_id = ?`;
      params.push(filter.user_id);
    }
    if (filter.status) {
      sql += ` AND pwl.status = ?`;
      params.push(filter.status);
    }
    if (filter.approval_status) {
      sql += ` AND pwl.approval_status = ?`;
      params.push(filter.approval_status);
    }
    const fromDate = filter.from_date || filter.start_date;
    const toDate = filter.to_date || filter.end_date;

    if (fromDate) {
      sql += ` AND pwl.end_date >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      sql += ` AND pwl.start_date <= ?`;
      params.push(toDate);
    }
    if (filter.activity_type) {
      sql += ` AND pwl.activity_type = ?`;
      params.push(filter.activity_type);
    }
    if (filter.search) {
      sql += ` AND (pwl.title LIKE ? OR pwl.description LIKE ? OR pwl.result_outcome LIKE ? OR u.full_name LIKE ? OR u.employee_code LIKE ?)`;
      params.push(`%${filter.search}%`, `%${filter.search}%`, `%${filter.search}%`, `%${filter.search}%`, `%${filter.search}%`);
    }

    sql += ` ORDER BY pwl.start_date DESC, pwl.start_time DESC, pwl.created_at DESC`;
    return await db.allAsync(sql, params);
  },

  async approveLog(id, approverId, status = 'approved', comment = null) {
    return await db.runAsync(`
      UPDATE personal_work_logs
      SET approval_status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, approval_comment = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, approverId, comment, id]);
  },

  async batchApprove(ids, approverId, status = 'approved') {
    if (!ids || ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    return await db.runAsync(`
      UPDATE personal_work_logs
      SET approval_status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `, [status, approverId, ...ids]);
  },

  async findById(id) {
    return await db.getAsync(`
      SELECT pwl.*, 
             u.full_name as user_name, u.role as user_role, u.position as user_position, u.employee_code,
             d.name as department_name, d.code as department_code,
             t.title as ref_task_title,
             appr.full_name as approved_by_name,
             sup.full_name as supervisor_name, sup.position as supervisor_position, sup.role as supervisor_role
      FROM personal_work_logs pwl
      JOIN users u ON pwl.user_id = u.id
      LEFT JOIN departments d ON pwl.department_id = d.id
      LEFT JOIN tasks t ON pwl.task_id = t.id
      LEFT JOIN users appr ON pwl.approved_by = appr.id
      LEFT JOIN users sup ON pwl.supervisor_id = sup.id
      WHERE pwl.id = ?
    `, [id]);
  },

  async checkOverlap(userId, startDate, startTime, endTime, excludeId = null) {
    if (!startTime || !endTime) return [];
    let sql = `
      SELECT id, title, start_time, end_time FROM personal_work_logs
      WHERE user_id = ? 
        AND start_date = ? 
        AND start_time IS NOT NULL 
        AND end_time IS NOT NULL
        AND start_time < ? 
        AND end_time > ?
    `;
    const params = [userId, startDate, endTime, startTime];
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }
    return await db.allAsync(sql, params);
  },

  async create(data) {
    const status = data.status || 'in_progress';
    const autoComplete = data.auto_complete !== undefined ? data.auto_complete : 1;
    const completedAt = status === 'completed' ? new Date().toISOString() : null;

    const res = await db.runAsync(`
      INSERT INTO personal_work_logs (
        user_id, department_id, supervisor_id, task_id, task_name, title, activity_type,
        start_date, end_date, start_time, end_time, hours_spent, location,
        description, result_outcome, attachment_url, status, auto_complete, completed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.user_id, data.department_id, data.supervisor_id || null, data.task_id || null, data.task_name || null,
      data.title, data.activity_type || 'Công tác chuyên môn',
      data.start_date, data.end_date, data.start_time || null, data.end_time || null,
      data.hours_spent || 8.0, data.location || 'Tại Trường ĐT CB Agribank',
      data.description, data.result_outcome || null, data.attachment_url || null,
      status, autoComplete, completedAt
    ]);
    return res.lastID;
  },

  async update(id, data) {
    let completedAt = null;
    if (data.status === 'completed') {
      completedAt = new Date().toISOString();
    }

    return await db.runAsync(`
      UPDATE personal_work_logs
      SET supervisor_id = ?, task_id = ?, task_name = ?, title = ?, activity_type = ?,
          start_date = ?, end_date = ?, start_time = ?, end_time = ?,
          hours_spent = ?, location = ?, description = ?, result_outcome = ?,
          attachment_url = ?, status = COALESCE(?, status),
          auto_complete = COALESCE(?, auto_complete),
          completed_at = COALESCE(?, completed_at),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      data.supervisor_id !== undefined ? data.supervisor_id : null,
      data.task_id || null, data.task_name || null, data.title, data.activity_type,
      data.start_date, data.end_date, data.start_time || null, data.end_time || null,
      data.hours_spent, data.location, data.description, data.result_outcome || null,
      data.attachment_url || null, data.status || null,
      data.auto_complete !== undefined ? data.auto_complete : null,
      completedAt, id
    ]);
  },

  async updateStatus(id, status) {
    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    return await db.runAsync(`
      UPDATE personal_work_logs
      SET status = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, completedAt, id]);
  },

  async delete(id) {
    return await db.runAsync('DELETE FROM personal_work_logs WHERE id = ?', [id]);
  },

  async getStats(filter = {}, user = null) {
    let sql = `
      SELECT 
        COUNT(*) as total_logs,
        COALESCE(SUM(hours_spent), 0) as total_hours,
        COUNT(DISTINCT start_date) as active_days,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        activity_type,
        COUNT(*) as type_count,
        SUM(hours_spent) as type_hours
      FROM personal_work_logs pwl
      WHERE 1=1
    `;
    const params = [];

    if (filter.supervisor_id) {
      sql += ` AND pwl.supervisor_id = ?`;
      params.push(filter.supervisor_id);
    } else if (user && user.role === 'staff') {
      sql += ` AND pwl.user_id = ?`;
      params.push(user.id);
    } else if (user && user.role === 'manager') {
      const targetDept = filter.department_id || user.department_id;
      if (targetDept) {
        sql += ` AND (pwl.department_id = ? OR pwl.supervisor_id = ?)`;
        params.push(targetDept, user.id);
      }
    } else if (filter.department_id) {
      sql += ` AND pwl.department_id = ?`;
      params.push(filter.department_id);
    }

    if (filter.user_id && filter.user_id !== 'all') {
      sql += ` AND pwl.user_id = ?`;
      params.push(filter.user_id);
    }
    const fromDate = filter.from_date || filter.start_date;
    const toDate = filter.to_date || filter.end_date;

    if (fromDate) {
      sql += ` AND pwl.end_date >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      sql += ` AND pwl.start_date <= ?`;
      params.push(toDate);
    }

    sql += ` GROUP BY pwl.activity_type`;
    return await db.allAsync(sql, params);
  }
};

module.exports = DiaryRepository;
