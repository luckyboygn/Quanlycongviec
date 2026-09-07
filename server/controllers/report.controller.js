const ReportRepository = require('../repositories/report.repository');
const TaskRepository = require('../repositories/task.repository');
const DiaryRepository = require('../repositories/diary.repository');
const { logActivity, createNotification } = require('../utils/logger');

const ReportController = {
  async getAll(req, res) {
    try {
      const reports = await ReportRepository.findAll(req.query, req.user);
      res.json(reports);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi lấy danh sách báo cáo' });
    }
  },

  async aggregateData(req, res) {
    try {
      const { type, start_date, end_date } = req.query;
      const tasks = await TaskRepository.findAll({ start_date, due_date: end_date }, req.user);
      const logs = await DiaryRepository.findAll({ start_date, end_date }, req.user);

      res.json({
        tasks_count: tasks.length,
        completed_tasks: tasks.filter(t => t.status === 'completed').length,
        logs_count: logs.length,
        total_hours: logs.reduce((sum, l) => sum + (l.hours_spent || 0), 0),
        tasks_summary: tasks.map(t => ({ id: t.id, title: t.title, status: t.status, progress: t.progress }))
      });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi tổng hợp dữ liệu báo cáo' });
    }
  },

  async create(req, res) {
    try {
      const { type, report_date, title, content_done, content_inprogress, content_issues, tasks_summary } = req.body;
      if (!type || !report_date || !title || !content_done) {
        return res.status(400).json({ error: 'Vui lòng điền đầy đủ các thông tin bắt buộc của báo cáo' });
      }

      const reportId = await ReportRepository.create({
        user_id: req.user.id, department_id: req.user.department_id,
        type, report_date, title, content_done, content_inprogress,
        content_issues, tasks_summary
      });

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'SUBMIT_REPORT', 'reports', reportId, `Nộp báo cáo: "${title}" (${type})`, clientIp);

      const newReport = await ReportRepository.findById(reportId);
      res.status(201).json(newReport);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi tạo báo cáo: ' + err.message });
    }
  },

  async review(req, res) {
    try {
      const reportId = parseInt(req.params.id);
      const { status, review_comment } = req.body;
      if (!['approved', 'rejected', 'revision_requested'].includes(status)) {
        return res.status(400).json({ error: 'Trạng thái phê duyệt không hợp lệ' });
      }

      const report = await ReportRepository.findById(reportId);
      if (!report) return res.status(404).json({ error: 'Không tìm thấy báo cáo' });

      await ReportRepository.review(reportId, req.user.id, status, review_comment || null);

      await createNotification(
        report.user_id,
        'Kết quả duyệt báo cáo',
        `Báo cáo "${report.title}" của bạn đã được ${status === 'approved' ? 'Phê duyệt' : status === 'rejected' ? 'Từ chối' : 'Yêu cầu chỉnh sửa'}.`,
        'report_review',
        reportId
      );

      const updated = await ReportRepository.findById(reportId);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi phê duyệt báo cáo' });
    }
  }
};

module.exports = ReportController;
