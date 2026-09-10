const db = require('../database/connection');

const DashboardService = {
  async getStats(user, query = {}) {
    const today = new Date().toISOString().split('T')[0];
    const deptId = query.department_id ? parseInt(query.department_id) : (user.department_id || 1);

    const [tasksStat, logsStat] = await Promise.all([
      db.getAsync(`
        SELECT 
          COUNT(*) as inst_total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as inst_completed,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inst_in_progress,
          SUM(CASE WHEN status = 'overdue' OR (status != 'completed' AND due_date IS NOT NULL AND due_date < ?) THEN 1 ELSE 0 END) as inst_overdue,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as inst_pending,
          ROUND(AVG(COALESCE(progress, 0)), 1) as inst_avg_progress,

          SUM(CASE WHEN department_id = ? THEN 1 ELSE 0 END) as dept_total,
          SUM(CASE WHEN department_id = ? AND status = 'completed' THEN 1 ELSE 0 END) as dept_completed,
          SUM(CASE WHEN department_id = ? AND status = 'in_progress' THEN 1 ELSE 0 END) as dept_in_progress,
          SUM(CASE WHEN department_id = ? AND (status = 'overdue' OR (status != 'completed' AND due_date IS NOT NULL AND due_date < ?)) THEN 1 ELSE 0 END) as dept_overdue,
          SUM(CASE WHEN department_id = ? AND status = 'pending' THEN 1 ELSE 0 END) as dept_pending,
          ROUND(AVG(CASE WHEN department_id = ? THEN COALESCE(progress, 0) ELSE NULL END), 1) as dept_avg_progress
        FROM tasks
      `, [today, deptId, deptId, deptId, deptId, today, deptId, deptId]),

      db.getAsync(`
        SELECT 
          COUNT(*) as inst_total_logs,
          COALESCE(SUM(hours_spent), 0) as inst_total_log_hours,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inst_in_progress_logs,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as inst_completed_logs,

          SUM(CASE WHEN department_id = ? THEN 1 ELSE 0 END) as dept_total_logs,
          COALESCE(SUM(CASE WHEN department_id = ? THEN hours_spent ELSE 0 END), 0) as dept_total_log_hours,
          SUM(CASE WHEN department_id = ? AND status = 'in_progress' THEN 1 ELSE 0 END) as dept_in_progress_logs,
          SUM(CASE WHEN department_id = ? AND status = 'completed' THEN 1 ELSE 0 END) as dept_completed_logs
        FROM personal_work_logs
      `, [deptId, deptId, deptId, deptId])
    ]);

    const ts = tasksStat || {};
    const ls = logsStat || {};

    return {
      institute: {
        total: parseInt(ts.inst_total || 0),
        completed: parseInt(ts.inst_completed || 0),
        in_progress: parseInt(ts.inst_in_progress || 0),
        overdue: parseInt(ts.inst_overdue || 0),
        pending: parseInt(ts.inst_pending || 0),
        avg_progress: parseFloat(ts.inst_avg_progress || 0),
        total_logs: parseInt(ls.inst_total_logs || 0),
        total_log_hours: parseFloat(ls.inst_total_log_hours || 0),
        in_progress_logs: parseInt(ls.inst_in_progress_logs || 0),
        completed_logs: parseInt(ls.inst_completed_logs || 0)
      },
      department: {
        department_id: deptId,
        total: parseInt(ts.dept_total || 0),
        completed: parseInt(ts.dept_completed || 0),
        in_progress: parseInt(ts.dept_in_progress || 0),
        overdue: parseInt(ts.dept_overdue || 0),
        pending: parseInt(ts.dept_pending || 0),
        avg_progress: parseFloat(ts.dept_avg_progress || 0),
        total_logs: parseInt(ls.dept_total_logs || 0),
        total_log_hours: parseFloat(ls.dept_total_log_hours || 0),
        in_progress_logs: parseInt(ls.dept_in_progress_logs || 0),
        completed_logs: parseInt(ls.dept_completed_logs || 0)
      }
    };
  },

  async getDepartmentsComparison() {
    return await db.allAsync(`
      SELECT d.id, d.name, d.code,
             COUNT(DISTINCT t.id) as total_tasks,
             SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
             SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as inprogress_tasks,
             SUM(CASE WHEN t.status = 'overdue' THEN 1 ELSE 0 END) as overdue_tasks,
             SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
             ROUND(AVG(COALESCE(t.progress, 0)), 1) as avg_progress,
             (SELECT COUNT(*) FROM personal_work_logs WHERE department_id = d.id) as total_logs,
             (SELECT COALESCE(SUM(hours_spent), 0) FROM personal_work_logs WHERE department_id = d.id) as total_log_hours,
             (SELECT COUNT(*) FROM personal_work_logs WHERE department_id = d.id AND status = 'in_progress') as in_progress_logs,
             (SELECT COUNT(*) FROM personal_work_logs WHERE department_id = d.id AND status = 'completed') as completed_logs
      FROM departments d
      LEFT JOIN tasks t ON d.id = t.department_id
      GROUP BY d.id
      ORDER BY d.id ASC
    `);
  },

  async getDepartmentMembersComparison(deptId) {
    return await db.allAsync(`
      SELECT u.id, u.full_name, u.position, u.role,
             COUNT(DISTINCT ta.task_id) as total_tasks,
             SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
             SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as inprogress_tasks,
             SUM(CASE WHEN t.status = 'overdue' THEN 1 ELSE 0 END) as overdue_tasks,
             ROUND(AVG(COALESCE(t.progress, 0)), 1) as avg_progress,
             (SELECT COUNT(*) FROM personal_work_logs WHERE user_id = u.id) as total_logs,
             (SELECT COALESCE(SUM(hours_spent), 0) FROM personal_work_logs WHERE user_id = u.id) as total_log_hours,
             (SELECT COUNT(*) FROM personal_work_logs WHERE user_id = u.id AND status = 'in_progress') as in_progress_logs,
             (SELECT COUNT(*) FROM personal_work_logs WHERE user_id = u.id AND status = 'completed') as completed_logs
      FROM users u
      LEFT JOIN task_assignees ta ON u.id = ta.user_id
      LEFT JOIN tasks t ON ta.task_id = t.id
      WHERE u.department_id = ?
      GROUP BY u.id
      ORDER BY total_tasks DESC, total_log_hours DESC, u.full_name ASC
    `, [deptId]);
  },

  async getStatusDistribution(user, query = {}) {
    let baseFilter = '';
    const params = [];
    const deptId = query.department_id ? parseInt(query.department_id) : user.department_id;

    if (deptId && user.role !== 'director' && user.role !== 'admin') {
      baseFilter = ' WHERE department_id = ?';
      params.push(deptId);
    } else if (query.department_id) {
      baseFilter = ' WHERE department_id = ?';
      params.push(parseInt(query.department_id));
    }

    const rows = await db.allAsync(`
      SELECT status, COUNT(*) as count
      FROM tasks
      ${baseFilter}
      GROUP BY status
    `, params);

    const result = {
      completed: 0,
      in_progress: 0,
      pending: 0,
      overdue: 0
    };

    rows.forEach(r => {
      if (result[r.status] !== undefined) {
        result[r.status] = r.count;
      }
    });

    return result;
  }
};

module.exports = DashboardService;
