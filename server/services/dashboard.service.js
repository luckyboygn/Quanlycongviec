const db = require('../database/connection');

const DashboardService = {
  async getStats(user, query = {}) {
    const today = new Date().toISOString().split('T')[0];
    const deptId = query.department_id ? parseInt(query.department_id) : (user.department_id || 1);

    // 1. Institute Level Metrics
    const instTasksTotal = await db.getAsync(`SELECT COUNT(*) as count FROM tasks`);
    const instTasksComp = await db.getAsync(`SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'`);
    const instTasksInProg = await db.getAsync(`SELECT COUNT(*) as count FROM tasks WHERE status = 'in_progress'`);
    const instTasksOverdue = await db.getAsync(`SELECT COUNT(*) as count FROM tasks WHERE status = 'overdue' OR (status != 'completed' AND due_date IS NOT NULL AND due_date < ?)`, [today]);
    const instTasksPending = await db.getAsync(`SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'`);
    const instAvgProg = await db.getAsync(`SELECT ROUND(AVG(COALESCE(progress, 0)), 1) as avg FROM tasks`);

    const instLogsTotal = await db.getAsync(`SELECT COUNT(*) as count, COALESCE(SUM(hours_spent), 0) as total_hours FROM personal_work_logs`);
    const instLogsInProg = await db.getAsync(`SELECT COUNT(*) as count FROM personal_work_logs WHERE status = 'in_progress'`);
    const instLogsComp = await db.getAsync(`SELECT COUNT(*) as count FROM personal_work_logs WHERE status = 'completed'`);

    // 2. Department Level Metrics
    const deptTasksTotal = await db.getAsync(`SELECT COUNT(*) as count FROM tasks WHERE department_id = ?`, [deptId]);
    const deptTasksComp = await db.getAsync(`SELECT COUNT(*) as count FROM tasks WHERE department_id = ? AND status = 'completed'`, [deptId]);
    const deptTasksInProg = await db.getAsync(`SELECT COUNT(*) as count FROM tasks WHERE department_id = ? AND status = 'in_progress'`, [deptId]);
    const deptTasksOverdue = await db.getAsync(`SELECT COUNT(*) as count FROM tasks WHERE department_id = ? AND (status = 'overdue' OR (status != 'completed' AND due_date IS NOT NULL AND due_date < ?))`, [deptId, today]);
    const deptTasksPending = await db.getAsync(`SELECT COUNT(*) as count FROM tasks WHERE department_id = ? AND status = 'pending'`, [deptId]);
    const deptAvgProg = await db.getAsync(`SELECT ROUND(AVG(COALESCE(progress, 0)), 1) as avg FROM tasks WHERE department_id = ?`, [deptId]);

    const deptLogsTotal = await db.getAsync(`SELECT COUNT(*) as count, COALESCE(SUM(hours_spent), 0) as total_hours FROM personal_work_logs WHERE department_id = ?`, [deptId]);
    const deptLogsInProg = await db.getAsync(`SELECT COUNT(*) as count FROM personal_work_logs WHERE department_id = ? AND status = 'in_progress'`, [deptId]);
    const deptLogsComp = await db.getAsync(`SELECT COUNT(*) as count FROM personal_work_logs WHERE department_id = ? AND status = 'completed'`, [deptId]);

    const iTotal = instTasksTotal ? instTasksTotal.count : 0;
    const iComp = instTasksComp ? instTasksComp.count : 0;
    const dTotal = deptTasksTotal ? deptTasksTotal.count : 0;
    const dComp = deptTasksComp ? deptTasksComp.count : 0;

    return {
      institute: {
        total: iTotal,
        completed: iComp,
        in_progress: instTasksInProg ? instTasksInProg.count : 0,
        overdue: instTasksOverdue ? instTasksOverdue.count : 0,
        pending: instTasksPending ? instTasksPending.count : 0,
        avg_progress: instAvgProg ? (instAvgProg.avg || 0) : 0,
        total_logs: instLogsTotal ? instLogsTotal.count : 0,
        total_log_hours: instLogsTotal ? instLogsTotal.total_hours : 0,
        in_progress_logs: instLogsInProg ? instLogsInProg.count : 0,
        completed_logs: instLogsComp ? instLogsComp.count : 0
      },
      department: {
        department_id: deptId,
        total: dTotal,
        completed: dComp,
        in_progress: deptTasksInProg ? deptTasksInProg.count : 0,
        overdue: deptTasksOverdue ? deptTasksOverdue.count : 0,
        pending: deptTasksPending ? deptTasksPending.count : 0,
        avg_progress: deptAvgProg ? (deptAvgProg.avg || 0) : 0,
        total_logs: deptLogsTotal ? deptLogsTotal.count : 0,
        total_log_hours: deptLogsTotal ? deptLogsTotal.total_hours : 0,
        in_progress_logs: deptLogsInProg ? deptLogsInProg.count : 0,
        completed_logs: deptLogsComp ? deptLogsComp.count : 0
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
