const NewsRepository = require('../repositories/news.repository');
const { logActivity } = require('../utils/logger');

const NewsController = {
  async getAll(req, res) {
    try {
      const news = await NewsRepository.findAll();
      res.json(news);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi tải danh sách bản tin: ' + err.message });
    }
  },

  async getById(req, res) {
    try {
      const news = await NewsRepository.findById(req.params.id);
      if (!news) return res.status(404).json({ error: 'Không tìm thấy bản tin' });
      res.json(news);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi tải chi tiết bản tin' });
    }
  },

  async create(req, res) {
    try {
      const { title, summary, content, category, badge_color, is_pinned, image_url, news_date } = req.body;
      if (!title || !content) {
        return res.status(400).json({ error: 'Vui lòng nhập tiêu đề và nội dung bản tin' });
      }

      const newsId = await NewsRepository.create({
        title,
        summary,
        content,
        category: category || 'Lịch công tác',
        badge_color: badge_color || 'emerald',
        author_id: req.user.id,
        author_name: req.user.full_name || 'Ban Quản trị',
        is_pinned: is_pinned ? 1 : 0,
        image_url,
        news_date: news_date || null
      });

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'CREATE_NEWS', 'news', newsId, `Đăng tin: "${title}"`, clientIp);

      const created = await NewsRepository.findById(newsId);
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi đăng bản tin: ' + err.message });
    }
  },

  async update(req, res) {
    try {
      const newsId = parseInt(req.params.id);
      const { title, summary, content, category, badge_color, is_pinned, image_url, news_date } = req.body;
      const updated = await NewsRepository.update(newsId, {
        title, summary, content, category, badge_color, is_pinned, image_url, news_date
      });

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'UPDATE_NEWS', 'news', newsId, `Cập nhật tin: "${title || newsId}"`, clientIp);

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi cập nhật bản tin: ' + err.message });
    }
  },

  async togglePin(req, res) {
    try {
      const newsId = parseInt(req.params.id);
      const result = await NewsRepository.togglePin(newsId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi ghim bản tin: ' + err.message });
    }
  },

  async delete(req, res) {
    try {
      const newsId = parseInt(req.params.id);
      await NewsRepository.delete(newsId);

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'DELETE_NEWS', 'news', newsId, `Xóa bản tin ID: ${newsId}`, clientIp);

      res.json({ message: 'Đã xóa bản tin thành công' });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi xóa bản tin: ' + err.message });
    }
  }
};

module.exports = NewsController;
