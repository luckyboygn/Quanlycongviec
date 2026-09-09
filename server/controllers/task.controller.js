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
      const { title, description, department_id, priority, start_date, due_date, assignee_ids, leader_id, attachment_links } = req.body;
      if (!title || !department_id || !start_date || !due_date) {
        return res.status(400).json({ error: 'Vui lòng nhập đầy đủ các trường bắt buộc' });
      }

      let deptId = department_id;
      if (req.user.role === 'manager') {
        deptId = req.user.department_id;
      }

      const taskId = await TaskRepository.create({
        title, description, department_id: deptId, created_by: req.user.id,
        priority: priority || 'medium', start_date, due_date, attachment_links: attachment_links || []
      }, assignee_ids || [], leader_id);

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'CREATE_TASK', 'tasks', taskId, `Tạo công việc: "${title}"`, clientIp);

      if (assignee_ids && assignee_ids.length > 0) {
        for (const uid of assignee_ids) {
          if (uid != req.user.id) {
            await createNotification(uid, 'Giao công việc mới', `Bạn được giao công việc: "${title}". Hạn chót: ${due_date}`, 'task_assigned', taskId);
          }
        }
      }

      const newTask = await TaskRepository.findById(taskId);
      res.status(201).json(newTask);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi tạo công việc: ' + err.message });
    }
  },

  async update(req, res) {
    try {
      const taskId = parseInt(req.params.id);
      const { title, description, department_id, priority, status, progress, start_date, due_date, assignee_ids, leader_id, attachment_links } = req.body;

      const updatedTask = await TaskRepository.update(taskId, {
        title, description, department_id: department_id || req.user.department_id,
        priority: priority || 'medium', status: status || 'pending', progress: progress || 0,
        start_date, due_date, attachment_links: attachment_links || []
      }, assignee_ids, leader_id);

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'UPDATE_TASK', 'tasks', taskId, `Cập nhật công việc: "${title}"`, clientIp);

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
  }
};

module.exports = TaskController;
