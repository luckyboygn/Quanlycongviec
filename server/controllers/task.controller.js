const TaskRepository = require('../repositories/task.repository');
const { logActivity, createNotification } = require('../utils/logger');

const TaskController = {
  async getAll(req, res) {
    try {
      const tasks = await TaskRepository.findAll(req.query, req.user);
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi lấy danh sách công việc' });
    }
  },

  async getById(req, res) {
    try {
      const task = await TaskRepository.findById(req.params.id);
      if (!task) return res.status(404).json({ error: 'Không tìm thấy công việc' });
      res.json(task);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi lấy chi tiết công việc' });
    }
  },

  async create(req, res) {
    try {
      const { title, description, department_id, priority, start_date, due_date, assignee_ids, leader_id, assignees, attachment_links } = req.body;
      if (!title || !department_id || !start_date || !due_date) {
        return res.status(400).json({ error: 'Vui lòng nhập đầy đủ các trường bắt buộc' });
      }

      let deptId = department_id;
      if (req.user.role === 'manager') {
        deptId = req.user.department_id;
      }

      let parsedAssignees = [];
      if (Array.isArray(assignees) && assignees.length > 0) {
        parsedAssignees = assignees.map(a => ({
          user_id: typeof a === 'object' ? parseInt(a.user_id) : parseInt(a),
          is_leader: typeof a === 'object' ? (a.is_leader ? 1 : 0) : ((leader_id && parseInt(a) === parseInt(leader_id)) ? 1 : 0)
        }));
      } else if (Array.isArray(assignee_ids) && assignee_ids.length > 0) {
        parsedAssignees = assignee_ids.map(uid => ({
          user_id: parseInt(uid),
          is_leader: (leader_id && parseInt(uid) === parseInt(leader_id)) ? 1 : 0
        }));
      }

      // If no specific assignees selected (e.g. BGĐ assigns to entire department), auto-assign to the Department Manager
      if (parsedAssignees.length === 0 && deptId) {
        const db = require('../database/connection');
        const deptManager = await db.getAsync(`
          SELECT id, full_name, role, position FROM users 
          WHERE department_id = ? AND (role = 'manager' OR position LIKE '%Trưởng phòng%' OR position LIKE '%Phó phòng%')
          ORDER BY CASE WHEN position LIKE '%Trưởng phòng%' THEN 1 WHEN role = 'manager' THEN 2 ELSE 3 END, id ASC
          LIMIT 1
        `, [deptId]);

        if (deptManager) {
          parsedAssignees.push({ user_id: deptManager.id, is_leader: 1 });
        }
      }

      const taskId = await TaskRepository.create({
        title, description, department_id: deptId, created_by: req.user.id,
        priority: priority || 'medium', start_date, due_date, attachment_links: attachment_links || []
      }, parsedAssignees);

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'CREATE_TASK', 'tasks', taskId, `Tạo công việc: "${title}"`, clientIp);

      if (parsedAssignees.length > 0) {
        for (const a of parsedAssignees) {
          if (a.user_id != req.user.id) {
            const roleDesc = a.is_leader ? 'Phụ trách chính' : 'Phối hợp thực hiện';
            await createNotification(
              a.user_id,
              'Giao công việc mới',
              `${req.user.full_name} (${req.user.role === 'director' ? 'Ban Giám đốc' : req.user.role === 'manager' ? 'Trưởng phòng' : 'Quản trị'}) đã giao cho bạn (${roleDesc}) công việc: "${title}". Hạn chót: ${due_date}`,
              'task_assigned',
              taskId
            );
          }
        }
      }

      const newTask = await TaskRepository.findById(taskId);
      res.status(201).json(newTask);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi tạo công việc: ' + err.message });
    }
  },

  async assignTask(req, res) {
    try {
      const taskId = parseInt(req.params.id);
      const task = await TaskRepository.findById(taskId);
      if (!task) return res.status(404).json({ error: 'Không tìm thấy công việc' });

      // Check permission: Director, Admin, Manager of the task's department, or Creator
      const isDirectorOrAdmin = req.user.role === 'director' || req.user.role === 'admin';
      const isManagerOfDept = req.user.role === 'manager' && req.user.department_id === task.department_id;
      const isCreator = req.user.id === task.created_by;

      if (!isDirectorOrAdmin && !isManagerOfDept && !isCreator) {
        return res.status(403).json({ error: 'Bạn không có quyền phân công lại công việc này' });
      }

      const { assignees, assignee_ids, leader_id, delegation_note } = req.body;
      let finalAssignees = [];

      if (Array.isArray(assignees)) {
        finalAssignees = assignees.map(a => ({
          user_id: typeof a === 'object' ? parseInt(a.user_id) : parseInt(a),
          is_leader: typeof a === 'object' ? (a.is_leader ? 1 : 0) : ((leader_id && parseInt(a) === parseInt(leader_id)) ? 1 : 0)
        }));
      } else if (Array.isArray(assignee_ids)) {
        finalAssignees = assignee_ids.map(uid => ({
          user_id: parseInt(uid),
          is_leader: (leader_id && parseInt(uid) === parseInt(leader_id)) ? 1 : 0
        }));
      }

      // If leader_id is set explicitly, make sure it is marked as leader
      if (leader_id) {
        let found = false;
        finalAssignees.forEach(a => {
          if (a.user_id === parseInt(leader_id)) {
            a.is_leader = 1;
            found = true;
          }
        });
        if (!found) {
          finalAssignees.push({ user_id: parseInt(leader_id), is_leader: 1 });
        }
      }

      // Save to database
      await TaskRepository.updateAssignees(taskId, finalAssignees);

      // If delegation note is provided, add log
      if (delegation_note && delegation_note.trim()) {
        const today = new Date().toISOString().split('T')[0];
        await TaskRepository.addLog(taskId, req.user.id, today, task.progress || 0, `[Phân công giao việc] ${delegation_note.trim()}`);
      }

      // Log activity
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'ASSIGN_TASK', 'tasks', taskId, `Phân công nhân sự cho công việc: "${task.title}"`, clientIp);

      // Send notifications to assignees
      for (const a of finalAssignees) {
        if (a.user_id !== req.user.id) {
          const roleTitle = a.is_leader ? 'Phụ trách chính (Chủ trì)' : 'Phối hợp thực hiện';
          const senderRole = req.user.role === 'director' ? 'Ban Giám đốc' : req.user.role === 'manager' ? 'Trưởng phòng' : req.user.role === 'admin' ? 'Quản trị viên' : 'Cán bộ';
          await createNotification(
            a.user_id,
            'Phân công công việc mới',
            `${senderRole} ${req.user.full_name} đã phân công bạn (${roleTitle}) công việc: "${task.title}". Hạn chót: ${task.due_date}`,
            'task_assigned',
            taskId
          );
        }
      }

      const updated = await TaskRepository.findById(taskId);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi phân công công việc: ' + err.message });
    }
  },

  async update(req, res) {
    try {
      const taskId = parseInt(req.params.id);
      const { title, description, department_id, priority, status, progress, start_date, due_date, assignee_ids, leader_id, assignees, attachment_links } = req.body;

      let parsedAssignees = null;
      if (Array.isArray(assignees)) {
        parsedAssignees = assignees;
      } else if (Array.isArray(assignee_ids)) {
        parsedAssignees = assignee_ids;
      }

      const updatedTask = await TaskRepository.update(taskId, {
        title, description, department_id: department_id || req.user.department_id,
        priority: priority || 'medium', status: status || 'pending', progress: progress || 0,
        start_date, due_date, attachment_links: attachment_links || []
      }, parsedAssignees, leader_id);

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'UPDATE_TASK', 'tasks', taskId, `Cập nhật công việc: "${title || taskId}"`, clientIp);

      res.json(updatedTask);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi cập nhật công việc' });
    }
  },

  async updateProgress(req, res) {
    try {
      const taskId = parseInt(req.params.id);
      const { progress, status, note, log_date } = req.body;

      const task = await TaskRepository.updateProgress(taskId, parseInt(progress), status);
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'UPDATE_PROGRESS', 'tasks', taskId, `Cập nhật tiến độ ${progress}% (Trạng thái: ${task.status})`, clientIp);

      if (note) {
        const dateStr = log_date || new Date().toISOString().split('T')[0];
        await TaskRepository.addLog(taskId, req.user.id, dateStr, parseInt(progress), note);
      }

      res.json(task);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi cập nhật tiến độ: ' + err.message });
    }
  },

  async delete(req, res) {
    try {
      const taskId = parseInt(req.params.id);
      await TaskRepository.delete(taskId);
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'DELETE_TASK', 'tasks', taskId, `Xóa công việc ID: ${taskId}`, clientIp);

      res.json({ message: 'Đã xóa công việc thành công' });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi xóa công việc' });
    }
  },

  async addLog(req, res) {
    try {
      const taskId = parseInt(req.params.id);
      const { log_date, progress_percent, note } = req.body;
      if (!log_date || !note) {
        return res.status(400).json({ error: 'Vui lòng nhập ngày và nội dung ghi chú' });
      }

      await TaskRepository.addLog(taskId, req.user.id, log_date, progress_percent || null, note);
      if (progress_percent !== undefined && progress_percent !== null) {
        await TaskRepository.updateProgress(taskId, parseInt(progress_percent));
      }

      res.status(201).json({ message: 'Ghi nhật ký tiến độ thành công!' });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi thêm nhật ký tiến độ' });
    }
  },

  async extendDeadline(req, res) {
    try {
      const taskId = parseInt(req.params.id);
      const { due_date, reason } = req.body;
      if (!due_date) {
        return res.status(400).json({ error: 'Vui lòng chọn ngày hạn chót mới' });
      }

      const task = await TaskRepository.findById(taskId);
      if (!task) return res.status(404).json({ error: 'Không tìm thấy công việc' });

      // Permission check: Director, Admin, Manager of the task's department, Creator, or Leader
      const isDirectorOrAdmin = req.user.role === 'director' || req.user.role === 'admin';
      const isManagerOfDept = req.user.role === 'manager' && req.user.department_id === task.department_id;
      const isCreator = req.user.id === task.created_by;
      const isLeader = task.assignees && task.assignees.some(a => a.id === req.user.id && a.is_leader);

      if (!isDirectorOrAdmin && !isManagerOfDept && !isCreator && !isLeader) {
        return res.status(403).json({ error: 'Bạn không có quyền điều chỉnh hạn chót cho công việc này' });
      }

      const oldDueDate = task.due_date ? String(task.due_date).split('T')[0] : 'Chưa thiết lập';
      const newDueDate = String(due_date).split('T')[0];

      // Auto update status if task was overdue but new date is today or in future
      let newStatus = task.status;
      const today = new Date().toISOString().split('T')[0];
      if (task.status === 'overdue' && newDueDate >= today) {
        newStatus = task.progress > 0 ? 'in_progress' : 'pending';
      }

      const db = require('../database/connection');
      await db.runAsync(`
        UPDATE tasks 
        SET due_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newDueDate, newStatus, taskId]);

      // Add audit log to task_logs
      const logNote = `[Gia hạn / Điều chỉnh hạn chót] Thay đổi hạn chót từ ${oldDueDate} sang ${newDueDate}.${reason ? ` Lý do: ${reason.trim()}` : ''}`;
      await TaskRepository.addLog(taskId, req.user.id, today, task.progress || 0, logNote);

      // Log Activity
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'EXTEND_DEADLINE', 'tasks', taskId, `Gia hạn công việc "${task.title}" đến ${newDueDate}`, clientIp);

      // Send notifications to assignees
      if (task.assignees && task.assignees.length > 0) {
        for (const a of task.assignees) {
          if (a.id !== req.user.id) {
            await createNotification(
              a.id,
              'Điều chỉnh hạn chót công việc',
              `${req.user.full_name} đã điều chỉnh hạn chót công việc "${task.title}" sang ngày ${newDueDate}.${reason ? ` Lý do: ${reason.trim()}` : ''}`,
              'task_extended',
              taskId
            );
          }
        }
      }

      const updated = await TaskRepository.findById(taskId);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi điều chỉnh hạn chót: ' + err.message });
    }
  }
};

module.exports = TaskController;
