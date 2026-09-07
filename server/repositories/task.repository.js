const db = require('../database/connection');

const TaskRepository = {
  async findAll(filter = {}, user = null) {
    let sql = `
      SELECT t.*, 
             d.name as department_name, d.code as department_code,
             u.full_name as creator_name
      FROM tasks t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (user && user.role === 'manager') {
      sql += ` AND t.department_id = ?`;
      params.push(user.department_id);
    } else if (user && user.role === 'staff') {
      if (filter.view_mode === 'my_tasks') {
        sql += ` AND t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ?)`;
        params.push(user.id);
      } else {
        sql += ` AND (t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ?) OR t.department_id = ?)`;
        params.push(user.id, user.department_id);
      }
    } else if (filter.department_id) {
      sql += ` AND t.department_id = ?`;
      params.push(filter.department_id);
    }

    if (filter.assignee_id) {
      sql += ` AND t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ?)`;
      params.push(filter.assignee_id);
    }
    if (filter.status) {
      sql += ` AND t.status = ?`;
      params.push(filter.status);
    }
    if (filter.priority) {
      sql += ` AND t.priority = ?`;
      params.push(filter.priority);
    }
    if (filter.start_date) {
      sql += ` AND t.start_date >= ?`;
      params.push(filter.start_date);
    }
    if (filter.due_date) {
      sql += ` AND t.due_date <= ?`;
      params.push(filter.due_date);
    }
    if (filter.search) {
      sql += ` AND (t.title LIKE ? OR t.description LIKE ?)`;
      params.push(`%${filter.search}%`, `%${filter.search}%`);
    }

    sql += ` ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, t.due_date ASC, t.created_at DESC`;

    const tasks = await db.allAsync(sql, params);

    for (const task of tasks) {
      const assignees = await db.allAsync(`
        SELECT u.id, u.full_name, u.position, u.role, ta.is_leader
        FROM task_assignees ta
        JOIN users u ON ta.user_id = u.id
        WHERE ta.task_id = ?
        ORDER BY ta.is_leader DESC, u.full_name ASC
      `, [task.id]);
      task.assignees = assignees;
      try {
        task.attachment_links = task.attachment_links ? JSON.parse(task.attachment_links) : [];
      } catch (e) {
        task.attachment_links = [];
      }
    }

    return tasks;
  },

  async findById(id) {
    const task = await db.getAsync(`
      SELECT t.*, 
             d.name as department_name, d.code as department_code,
             u.full_name as creator_name
      FROM tasks t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `, [id]);

    if (!task) return null;

    task.assignees = await db.allAsync(`
      SELECT u.id, u.full_name, u.position, u.role, ta.is_leader
      FROM task_assignees ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id = ?
      ORDER BY ta.is_leader DESC, u.full_name ASC
    `, [task.id]);

    task.logs = await db.allAsync(`
      SELECT tl.*, u.full_name as user_name
      FROM task_logs tl
      LEFT JOIN users u ON tl.user_id = u.id
      WHERE tl.task_id = ?
      ORDER BY tl.log_date DESC, tl.created_at DESC
    `, [task.id]);

    try {
      task.attachment_links = task.attachment_links ? JSON.parse(task.attachment_links) : [];
    } catch (e) {
      task.attachment_links = [];
    }

    return task;
  },

  async create(taskData, assigneeIds = [], leaderId = null) {
    const res = await db.runAsync(`
      INSERT INTO tasks (title, description, department_id, created_by, priority, status, progress, start_date, due_date, attachment_links)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      taskData.title, taskData.description || null, taskData.department_id,
      taskData.created_by, taskData.priority || 'medium', taskData.status || 'pending',
      taskData.progress || 0, taskData.start_date, taskData.due_date,
      JSON.stringify(taskData.attachment_links || [])
    ]);

    const taskId = res.lastID;

    for (const uid of assigneeIds) {
      const isLeader = (leaderId && uid == leaderId) ? 1 : 0;
      await db.runAsync(`
        INSERT OR IGNORE INTO task_assignees (task_id, user_id, is_leader)
        VALUES (?, ?, ?)
      `, [taskId, uid, isLeader]);
    }

    return taskId;
  },

  async update(id, taskData, assigneeIds = null, leaderId = null) {
    const current = await this.findById(id);
    if (!current) return null;

    let completedAt = current.completed_at;
    if (taskData.status === 'completed' && current.status !== 'completed') {
      completedAt = new Date().toISOString();
    } else if (taskData.status && taskData.status !== 'completed') {
      completedAt = null;
    }

    await db.runAsync(`
      UPDATE tasks 
      SET title = ?, description = ?, department_id = ?, priority = ?, status = ?, progress = ?,
          start_date = ?, due_date = ?, completed_at = ?, attachment_links = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      taskData.title, taskData.description || null, taskData.department_id,
      taskData.priority, taskData.status, taskData.progress,
      taskData.start_date, taskData.due_date, completedAt,
      JSON.stringify(taskData.attachment_links || []), id
    ]);

    if (assigneeIds !== null) {
      await db.runAsync('DELETE FROM task_assignees WHERE task_id = ?', [id]);
      for (const uid of assigneeIds) {
        const isLeader = (leaderId && uid == leaderId) ? 1 : 0;
        await db.runAsync(`
          INSERT OR IGNORE INTO task_assignees (task_id, user_id, is_leader)
          VALUES (?, ?, ?)
        `, [id, uid, isLeader]);
      }
    }

    return await this.findById(id);
  },

  async updateProgress(id, progress, status = null) {
    let completedAt = null;
    if (progress === 100 || status === 'completed') {
      status = 'completed';
      completedAt = new Date().toISOString();
    } else if (!status) {
      status = progress > 0 ? 'in_progress' : 'pending';
    }

    await db.runAsync(`
      UPDATE tasks 
      SET progress = ?, status = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [progress, status, completedAt, id]);

    return await this.findById(id);
  },

  async delete(id) {
    return await db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);
  },

  async addLog(taskId, userId, logDate, progressPercent, note) {
    return await db.runAsync(`
      INSERT INTO task_logs (task_id, user_id, log_date, progress_percent, note)
      VALUES (?, ?, ?, ?, ?)
    `, [taskId, userId, logDate, progressPercent, note]);
  }
};

module.exports = TaskRepository;
