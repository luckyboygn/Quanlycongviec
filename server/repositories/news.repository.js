const db = require('../database/connection');

const NewsRepository = {
  async findAll() {
    return await db.allAsync(`
      SELECT n.*, u.full_name as author_full_name, u.role as author_role
      FROM news n
      LEFT JOIN users u ON n.author_id = u.id
      ORDER BY n.is_pinned DESC, n.news_date DESC, n.created_at DESC
    `);
  },

  async findById(id) {
    return await db.getAsync(`
      SELECT n.*, u.full_name as author_full_name, u.role as author_role
      FROM news n
      LEFT JOIN users u ON n.author_id = u.id
      WHERE n.id = ?
    `, [id]);
  },

  async create({ title, summary, content, category, badge_color, author_id, author_name, is_pinned, image_url, news_date }) {
    const res = await db.runAsync(`
      INSERT INTO news (title, summary, content, category, badge_color, author_id, author_name, is_pinned, image_url, news_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      title,
      summary || (content.length > 180 ? content.substring(0, 180) + '...' : content),
      content,
      category || 'Lịch công tác',
      badge_color || 'emerald',
      author_id || null,
      author_name || 'Ban Quản trị',
      is_pinned ? 1 : 0,
      image_url || null,
      news_date || null
    ]);
    return res.lastID;
  },

  async update(id, { title, summary, content, category, badge_color, is_pinned, image_url, news_date }) {
    await db.runAsync(`
      UPDATE news
      SET title = COALESCE(?, title),
          summary = COALESCE(?, summary),
          content = COALESCE(?, content),
          category = COALESCE(?, category),
          badge_color = COALESCE(?, badge_color),
          is_pinned = COALESCE(?, is_pinned),
          image_url = COALESCE(?, image_url),
          news_date = COALESCE(?, news_date),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [title, summary, content, category, badge_color, is_pinned, image_url, news_date || null, id]);
    return await this.findById(id);
  },

  async togglePin(id) {
    const news = await this.findById(id);
    if (!news) throw new Error('Không tìm thấy tin tức');
    const newPinned = news.is_pinned ? 0 : 1;
    await db.runAsync(`UPDATE news SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newPinned, id]);
    return { id, is_pinned: newPinned };
  },

  async delete(id) {
    await db.runAsync(`DELETE FROM news WHERE id = ?`, [id]);
    return true;
  }
};

module.exports = NewsRepository;
