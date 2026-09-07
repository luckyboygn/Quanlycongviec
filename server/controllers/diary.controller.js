const DiaryRepository = require('../repositories/diary.repository');
const { logActivity } = require('../utils/logger');

const DiaryController = {
  async getAll(req, res) {
    try {
      const logs = await DiaryRepository.findAll(req.query, req.user);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi lấy bản kê khai nhật ký' });
    }
  },

  async getStats(req, res) {
    try {
      const stats = await DiaryRepository.getStats(req.query, req.user);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi thống kê nhật ký' });
    }
  },

  async create(req, res) {
    try {
      const { title, activity_type, start_date, end_date, start_time, end_time, hours_spent, location, description, result_outcome, attachment_url, task_id, task_name, status, auto_complete, supervisor_id } = req.body;
      if (!title || !start_date || !end_date || !description) {
        return res.status(400).json({ error: 'Vui lòng điền đầy đủ tiêu đề, thời gian và nội dung công việc' });
      }

      // Logic kiểm tra trùng lặp giờ trong ngày
      if (start_time && end_time) {
        const overlap = await DiaryRepository.checkOverlap(req.user.id, start_date, start_time, end_time);
        if (overlap.length > 0) {
          return res.status(400).json({ 
            error: `Khung giờ (${start_time} - ${end_time}) đã bị trùng lặp với công việc "${overlap[0].title}" (${overlap[0].start_time} - ${overlap[0].end_time}) đã kê khai trong ngày ${start_date}. Vui lòng chọn khung giờ khác!`
          });
        }
      }

      const logId = await DiaryRepository.create({
        user_id: req.user.id, department_id: req.user.department_id,
        supervisor_id: supervisor_id ? parseInt(supervisor_id) : null,
        task_id, task_name, title, activity_type, start_date, end_date,
        start_time, end_time, hours_spent, location, description,
        result_outcome, attachment_url,
        status: status || 'in_progress',
        auto_complete: auto_complete !== undefined ? auto_complete : 1
      });

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'CREATE_PERSONAL_LOG', 'personal_work_logs', logId, `Kê khai nhật ký: "${title}" (${hours_spent || 8} giờ)`, clientIp);

      // Gửi thông báo đến Lãnh đạo phụ trách nếu được gắn
      if (supervisor_id && parseInt(supervisor_id) !== req.user.id) {
        try {
          const NotificationRepository = require('../repositories/notification.repository');
          await NotificationRepository.create({
            user_id: parseInt(supervisor_id),
            title: 'Kê khai công việc mới gắn với Lãnh đạo',
            content: `Cán bộ ${req.user.full_name} (${req.user.position || 'Cán bộ'}) đã kê khai công việc: "${title}" (${hours_spent || 8}h) gắn với bạn là Lãnh đạo phụ trách.`,
            type: 'info',
            related_id: logId
          });
        } catch (notifErr) {
          console.error('Error sending notification to supervisor:', notifErr);
        }
      }

      const newLog = await DiaryRepository.findById(logId);
      res.status(201).json(newLog);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi tạo kê khai: ' + err.message });
    }
  },

  async update(req, res) {
    try {
      const logId = parseInt(req.params.id);
      const current = await DiaryRepository.findById(logId);
      if (!current) return res.status(404).json({ error: 'Không tìm thấy bản kê khai' });

      if (current.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Bạn chỉ có quyền sửa bản kê khai của chính mình' });
      }

      const { title, activity_type, start_date, end_date, start_time, end_time, hours_spent, location, description, result_outcome, attachment_url, task_id, task_name, status, auto_complete, supervisor_id } = req.body;

      if (start_time && end_time) {
        const overlap = await DiaryRepository.checkOverlap(current.user_id, start_date || current.start_date, start_time, end_time, logId);
        if (overlap.length > 0) {
          return res.status(400).json({ 
            error: `Khung giờ (${start_time} - ${end_time}) đã bị trùng lặp với công việc "${overlap[0].title}" (${overlap[0].start_time} - ${overlap[0].end_time}) đã kê khai trong ngày ${start_date}. Vui lòng chọn khung giờ khác!`
          });
        }
      }

      await DiaryRepository.update(logId, {
        supervisor_id: supervisor_id !== undefined ? (supervisor_id ? parseInt(supervisor_id) : null) : current.supervisor_id,
        task_id, task_name, title, activity_type,
        start_date: start_date || current.start_date, end_date: end_date || current.end_date,
        start_time: start_time || null, end_time: end_time || null,
        hours_spent: hours_spent || current.hours_spent,
        location: location || current.location,
        description: description || current.description,
        result_outcome: result_outcome || null,
        attachment_url: attachment_url || null,
        status: status || current.status,
        auto_complete: auto_complete !== undefined ? auto_complete : current.auto_complete
      });

      const updated = await DiaryRepository.findById(logId);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi cập nhật kê khai: ' + err.message });
    }
  },

  async updateStatus(req, res) {
    try {
      const logId = parseInt(req.params.id);
      const { status } = req.body;
      if (!['in_progress', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
      }

      const current = await DiaryRepository.findById(logId);
      if (!current) return res.status(404).json({ error: 'Không tìm thấy bản kê khai' });

      const isAllowed = current.user_id === req.user.id || 
                        ['admin', 'director'].includes(req.user.role) ||
                        (req.user.role === 'manager' && current.department_id === req.user.department_id);

      if (!isAllowed) {
        return res.status(403).json({ error: 'Bạn chỉ có quyền thay đổi trạng thái bản kê khai của chính mình' });
      }

      await DiaryRepository.updateStatus(logId, status);
      const updated = await DiaryRepository.findById(logId);

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'UPDATE_LOG_STATUS', 'personal_work_logs', logId, `Chuyển trạng thái sang: ${status === 'completed' ? 'Đã hoàn thành' : 'Đang thực hiện'}`, clientIp);

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi cập nhật trạng thái: ' + err.message });
    }
  },

  async delete(req, res) {
    try {
      const logId = parseInt(req.params.id);
      const current = await DiaryRepository.findById(logId);
      if (!current) return res.status(404).json({ error: 'Không tìm thấy bản kê khai' });

      if (current.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Bạn chỉ có quyền xóa bản kê khai của chính mình' });
      }

      await DiaryRepository.delete(logId);
      res.json({ message: 'Đã xóa bản kê khai nhật ký thành công' });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi xóa bản kê khai' });
    }
  },

  async approve(req, res) {
    try {
      const logId = parseInt(req.params.id);
      const { status, comment } = req.body; // status: 'approved' | 'rejected' | 'pending'
      const targetStatus = status || 'approved';

      if (!['approved', 'rejected', 'pending'].includes(targetStatus)) {
        return res.status(400).json({ error: 'Trạng thái phê duyệt không hợp lệ' });
      }

      const current = await DiaryRepository.findById(logId);
      if (!current) return res.status(404).json({ error: 'Không tìm thấy bản kê khai nhật ký' });

      const isDirectorOrAdmin = ['admin', 'director'].includes(req.user.role);
      const isManager = req.user.role === 'manager' && (req.user.department_id === current.department_id || !current.department_id);

      if (!isDirectorOrAdmin && !isManager) {
        return res.status(403).json({ error: 'Chỉ Lãnh đạo hoặc Trưởng phòng phụ trách mới có quyền duyệt nhật ký này' });
      }

      await DiaryRepository.approveLog(logId, req.user.id, targetStatus, comment || null);
      const updated = await DiaryRepository.findById(logId);

      // Log activity
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const statusLabel = targetStatus === 'approved' ? 'Đã duyệt' : (targetStatus === 'rejected' ? 'Từ chối' : 'Chờ duyệt');
      await logActivity(req.user.id, req.user.full_name, 'APPROVE_DIARY_LOG', 'personal_work_logs', logId, `${statusLabel} nhật ký "${current.title}" của ${current.user_name}`, clientIp);

      // Create notification for log author
      if (current.user_id !== req.user.id) {
        const NotificationRepository = require('../repositories/notification.repository');
        await NotificationRepository.create({
          user_id: current.user_id,
          title: targetStatus === 'approved' ? 'Nhật ký công việc đã được duyệt' : 'Nhật ký công việc bị từ chối / cần sửa',
          content: `${req.user.full_name} (${req.user.position || req.user.role}) đã ${statusLabel.toLowerCase()} bản kê khai "${current.title}" (${current.hours_spent}h).${comment ? ' Ghi chú: ' + comment : ''}`,
          type: targetStatus === 'approved' ? 'success' : 'warning',
          related_id: logId
        });
      }

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi phê duyệt nhật ký: ' + err.message });
    }
  },

  async batchApprove(req, res) {
    try {
      const logIds = req.body.ids || req.body.log_ids;
      const targetStatus = req.body.status || 'approved';

      if (!Array.isArray(logIds) || logIds.length === 0) {
        return res.status(400).json({ error: 'Vui lòng chọn ít nhất một bản kê khai để duyệt' });
      }

      const isDirectorOrAdmin = ['admin', 'director'].includes(req.user.role);
      const isManager = req.user.role === 'manager';

      if (!isDirectorOrAdmin && !isManager) {
        return res.status(403).json({ error: 'Chỉ Lãnh đạo hoặc Trưởng phòng mới có quyền duyệt hàng loạt' });
      }

      await DiaryRepository.batchApprove(logIds, req.user.id, targetStatus);

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'BATCH_APPROVE_DIARY_LOGS', 'personal_work_logs', null, `Duyệt hàng loạt ${logIds.length} bản kê khai nhật ký`, clientIp);

      res.json({ message: `Đã ${targetStatus === 'approved' ? 'duyệt' : 'xử lý'} thành công ${logIds.length} bản kê khai nhật ký` });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi duyệt hàng loạt: ' + err.message });
    }
  }
};

module.exports = DiaryController;
