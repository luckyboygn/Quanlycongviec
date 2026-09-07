const NotificationRepository = require('../repositories/notification.repository');

const NotificationController = {
  async getMyNotifications(req, res) {
    try {
      const notifs = await NotificationRepository.findByUserId(req.user.id, 50);
      res.json(notifs);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi lấy thông báo' });
    }
  },

  async markAsRead(req, res) {
    try {
      await NotificationRepository.markAsRead(parseInt(req.params.id), req.user.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi cập nhật thông báo' });
    }
  },

  async markAllAsRead(req, res) {
    try {
      await NotificationRepository.markAllAsRead(req.user.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi cập nhật tất cả thông báo' });
    }
  }
};

module.exports = NotificationController;
