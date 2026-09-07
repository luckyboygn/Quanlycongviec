const DashboardService = require('../services/dashboard.service');

const DashboardController = {
  async getStats(req, res) {
    try {
      const stats = await DashboardService.getStats(req.user, req.query);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi lấy thống kê Dashboard' });
    }
  },

  async getDepartmentsComparison(req, res) {
    try {
      const depts = await DashboardService.getDepartmentsComparison();
      res.json(depts);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi so sánh phòng ban' });
    }
  },

  async getDepartmentMembersComparison(req, res) {
    try {
      const deptId = req.query.department_id ? parseInt(req.query.department_id) : req.user.department_id;
      const members = await DashboardService.getDepartmentMembersComparison(deptId);
      res.json(members);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi so sánh nhân viên trong phòng' });
    }
  },

  async getStatusDistribution(req, res) {
    try {
      const dist = await DashboardService.getStatusDistribution(req.user, req.query);
      res.json(dist);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi phân bố trạng thái' });
    }
  }
};

module.exports = DashboardController;
