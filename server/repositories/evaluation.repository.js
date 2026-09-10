const db = require('../database/connection');

const EvaluationRepository = {
  async findByUserAndPeriod(userId, month, year) {
    return await db.getAsync(`
      SELECT e.*, 
             u.full_name, u.position, u.role, u.department_id, d.name as department_name,
             mgr_u.full_name as approver_mgr_name, mgr_u.position as approver_mgr_position,
             dir_u.full_name as approver_director_name, dir_u.position as approver_director_position
      FROM evaluations e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN users mgr_u ON e.approver_mgr_id = mgr_u.id
      LEFT JOIN users dir_u ON e.approver_director_id = dir_u.id
      WHERE e.user_id = ? AND e.month = ? AND e.year = ?
    `, [userId, month, year]);
  },

  async findById(id) {
    return await db.getAsync(`
      SELECT e.*, 
             u.full_name, u.position, u.role, u.department_id, d.name as department_name,
             mgr_u.full_name as approver_mgr_name, mgr_u.position as approver_mgr_position,
             dir_u.full_name as approver_director_name, dir_u.position as approver_director_position
      FROM evaluations e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN users mgr_u ON e.approver_mgr_id = mgr_u.id
      LEFT JOIN users dir_u ON e.approver_director_id = dir_u.id
      WHERE e.id = ?
    `, [id]);
  },

  async upsert(data) {
    const existing = await this.findByUserAndPeriod(data.user_id, data.month, data.year);

    // Calculate average score across all valid tiers that gave scores
    const validScores = [];
    if (data.score_total !== undefined && data.score_total !== null && data.score_total > 0) validScores.push(data.score_total);
    else if (existing && existing.score_total > 0) validScores.push(existing.score_total);

    if (data.mgr_score_total !== undefined && data.mgr_score_total !== null && data.mgr_score_total > 0) validScores.push(data.mgr_score_total);
    else if (existing && existing.mgr_score_total > 0) validScores.push(existing.mgr_score_total);

    if (data.deputy_score_total !== undefined && data.deputy_score_total !== null && data.deputy_score_total > 0) validScores.push(data.deputy_score_total);
    else if (existing && existing.deputy_score_total > 0) validScores.push(existing.deputy_score_total);

    if (data.head_score_total !== undefined && data.head_score_total !== null && data.head_score_total > 0) validScores.push(data.head_score_total);
    else if (existing && existing.head_score_total > 0) validScores.push(existing.head_score_total);

    const computedAvg = validScores.length > 0 ? parseFloat((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2)) : 0;
    const finalAvg = data.avg_score_total !== undefined ? data.avg_score_total : computedAvg;

    if (existing) {
      await db.runAsync(`
        UPDATE evaluations
        SET period_name = ?,
            score_volume = ?,
            score_quality = ?,
            score_progress = ?,
            score_attitude = ?,
            score_discipline = ?,
            score_test = ?,
            score_total = ?,
            mgr_score_volume = ?,
            mgr_score_quality = ?,
            mgr_score_progress = ?,
            mgr_score_attitude = ?,
            mgr_score_discipline = ?,
            mgr_score_test = ?,
            mgr_score_total = ?,
            deputy_score_volume = ?,
            deputy_score_quality = ?,
            deputy_score_progress = ?,
            deputy_score_attitude = ?,
            deputy_score_discipline = ?,
            deputy_score_test = ?,
            deputy_score_total = ?,
            head_score_volume = ?,
            head_score_quality = ?,
            head_score_progress = ?,
            head_score_attitude = ?,
            head_score_discipline = ?,
            head_score_test = ?,
            head_score_total = ?,
            avg_score_total = ?,
            notes = ?,
            mgr_notes = ?,
            deputy_notes = ?,
            head_notes = ?,
            approver_mgr_id = COALESCE(?, approver_mgr_id),
            approver_director_id = COALESCE(?, approver_director_id),
            submitted_at = COALESCE(?, submitted_at),
            manager_approved_at = COALESCE(?, manager_approved_at),
            director_approved_at = COALESCE(?, director_approved_at),
            submission_note = COALESCE(?, submission_note),
            reject_reason = COALESCE(?, reject_reason),
            status = COALESCE(?, status),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        data.period_name || existing.period_name,
        data.score_volume !== undefined ? data.score_volume : existing.score_volume,
        data.score_quality !== undefined ? data.score_quality : existing.score_quality,
        data.score_progress !== undefined ? data.score_progress : existing.score_progress,
        data.score_attitude !== undefined ? data.score_attitude : existing.score_attitude,
        data.score_discipline !== undefined ? data.score_discipline : existing.score_discipline,
        data.score_test !== undefined ? data.score_test : existing.score_test,
        data.score_total !== undefined ? data.score_total : existing.score_total,

        data.mgr_score_volume !== undefined ? data.mgr_score_volume : existing.mgr_score_volume,
        data.mgr_score_quality !== undefined ? data.mgr_score_quality : existing.mgr_score_quality,
        data.mgr_score_progress !== undefined ? data.mgr_score_progress : existing.mgr_score_progress,
        data.mgr_score_attitude !== undefined ? data.mgr_score_attitude : existing.mgr_score_attitude,
        data.mgr_score_discipline !== undefined ? data.mgr_score_discipline : existing.mgr_score_discipline,
        data.mgr_score_test !== undefined ? data.mgr_score_test : existing.mgr_score_test,
        data.mgr_score_total !== undefined ? data.mgr_score_total : existing.mgr_score_total,

        data.deputy_score_volume !== undefined ? data.deputy_score_volume : existing.deputy_score_volume,
        data.deputy_score_quality !== undefined ? data.deputy_score_quality : existing.deputy_score_quality,
        data.deputy_score_progress !== undefined ? data.deputy_score_progress : existing.deputy_score_progress,
        data.deputy_score_attitude !== undefined ? data.deputy_score_attitude : existing.deputy_score_attitude,
        data.deputy_score_discipline !== undefined ? data.deputy_score_discipline : existing.deputy_score_discipline,
        data.deputy_score_test !== undefined ? data.deputy_score_test : existing.deputy_score_test,
        data.deputy_score_total !== undefined ? data.deputy_score_total : existing.deputy_score_total,

        data.head_score_volume !== undefined ? data.head_score_volume : existing.head_score_volume,
        data.head_score_quality !== undefined ? data.head_score_quality : existing.head_score_quality,
        data.head_score_progress !== undefined ? data.head_score_progress : existing.head_score_progress,
        data.head_score_attitude !== undefined ? data.head_score_attitude : existing.head_score_attitude,
        data.head_score_discipline !== undefined ? data.head_score_discipline : existing.head_score_discipline,
        data.head_score_test !== undefined ? data.head_score_test : existing.head_score_test,
        data.head_score_total !== undefined ? data.head_score_total : existing.head_score_total,

        finalAvg,
        data.notes !== undefined ? data.notes : existing.notes,
        data.mgr_notes !== undefined ? data.mgr_notes : existing.mgr_notes,
        data.deputy_notes !== undefined ? data.deputy_notes : existing.deputy_notes,
        data.head_notes !== undefined ? data.head_notes : existing.head_notes,
        data.approver_mgr_id !== undefined ? data.approver_mgr_id : null,
        data.approver_director_id !== undefined ? data.approver_director_id : null,
        data.submitted_at !== undefined ? data.submitted_at : null,
        data.manager_approved_at !== undefined ? data.manager_approved_at : null,
        data.director_approved_at !== undefined ? data.director_approved_at : null,
        data.submission_note !== undefined ? data.submission_note : null,
        data.reject_reason !== undefined ? data.reject_reason : null,
        data.status || null,
        existing.id
      ]);
      return existing.id;
    } else {
      const res = await db.runAsync(`
        INSERT INTO evaluations (
          user_id, month, year, period_name,
          score_volume, score_quality, score_progress, score_attitude, score_discipline, score_test, score_total,
          mgr_score_volume, mgr_score_quality, mgr_score_progress, mgr_score_attitude, mgr_score_discipline, mgr_score_test, mgr_score_total,
          deputy_score_volume, deputy_score_quality, deputy_score_progress, deputy_score_attitude, deputy_score_discipline, deputy_score_test, deputy_score_total,
          head_score_volume, head_score_quality, head_score_progress, head_score_attitude, head_score_discipline, head_score_test, head_score_total,
          avg_score_total, notes, mgr_notes, deputy_notes, head_notes,
          approver_mgr_id, approver_director_id, submitted_at, manager_approved_at, director_approved_at,
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?
        )
      `, [
        data.user_id, data.month, data.year, data.period_name || null,
        data.score_volume || 0, data.score_quality || 0, data.score_progress || 0, data.score_attitude || 0, data.score_discipline || 0, data.score_test || 0, data.score_total || 0,
        data.mgr_score_volume || null, data.mgr_score_quality || null, data.mgr_score_progress || null, data.mgr_score_attitude || null, data.mgr_score_discipline || null, data.mgr_score_test || null, data.mgr_score_total || null,
        data.deputy_score_volume || null, data.deputy_score_quality || null, data.deputy_score_progress || null, data.deputy_score_attitude || null, data.deputy_score_discipline || null, data.deputy_score_test || null, data.deputy_score_total || null,
        data.head_score_volume || null, data.head_score_quality || null, data.head_score_progress || null, data.head_score_attitude || null, data.head_score_discipline || null, data.head_score_test || null, data.head_score_total || null,
        finalAvg, data.notes || null, data.mgr_notes || null, data.deputy_notes || null, data.head_notes || null,
        data.approver_mgr_id || null, data.approver_director_id || null,
        data.submitted_at || null, data.manager_approved_at || null, data.director_approved_at || null,
        data.submission_note || null, data.reject_reason || null,
        data.status || 'draft'
      ]);
      return res.lastID;
    }
  },

  async getByDepartment(departmentId, month, year) {
    let sql = `
      SELECT e.*, 
             u.full_name, u.position, u.role, u.department_id, d.name as department_name,
             mgr_u.full_name as approver_mgr_name, mgr_u.position as approver_mgr_position,
             dir_u.full_name as approver_director_name, dir_u.position as approver_director_position
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN evaluations e ON e.user_id = u.id AND e.month = ? AND e.year = ?
      LEFT JOIN users mgr_u ON e.approver_mgr_id = mgr_u.id
      LEFT JOIN users dir_u ON e.approver_director_id = dir_u.id
      WHERE (u.status = 'active' OR u.status IS NULL)
    `;
    const params = [month, year];
    if (departmentId && departmentId !== 'all') {
      sql += ` AND u.department_id = ?`;
      params.push(departmentId);
    }
    sql += ` ORDER BY u.department_id ASC, u.id ASC`;
    return await db.allAsync(sql, params);
  }
};

module.exports = EvaluationRepository;
