const db = require('../database/connection');

const DepartmentRepository = {
  async findAll() {
    return await db.allAsync(`
      SELECT d.*, 
             COUNT(DISTINCT u.id) as members_count,
             COUNT(DISTINCT t.id) as tasks_count
      FROM departments d
      LEFT JOIN users u ON u.department_id = d.id
      LEFT JOIN tasks t ON t.department_id = d.id
      GROUP BY d.id
      ORDER BY d.id ASC
    `);
  },

  async findById(id) {
    return await db.getAsync('SELECT * FROM departments WHERE id = ?', [id]);
  },

  async findByCode(code) {
    return await db.getAsync('SELECT * FROM departments WHERE code = ?', [code]);
  },

  async create(dept) {
    return await db.runAsync(`
      INSERT INTO departments (name, code, description)
      VALUES (?, ?, ?)
    `, [dept.name, dept.code, dept.description || null]);
  },

  async update(id, dept) {
    return await db.runAsync(`
      UPDATE departments SET name = ?, code = ?, description = ?
      WHERE id = ?
    `, [dept.name, dept.code, dept.description || null, id]);
  },

  async delete(id) {
    return await db.runAsync('DELETE FROM departments WHERE id = ?', [id]);
  }
};

module.exports = DepartmentRepository;
