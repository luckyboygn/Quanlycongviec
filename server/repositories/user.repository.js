const db = require('../database/connection');

const UserRepository = {
  async findAll() {
    return await db.allAsync(`
      SELECT u.id, u.employee_code, u.username, u.full_name, u.email, u.phone, u.role, 
             u.department_id, u.position, u.birth_date, u.gender, u.qualification, 
             u.avatar, u.status, u.created_at,
             d.name as department_name, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.department_id ASC, u.role ASC, u.full_name ASC
    `);
  },

  async findById(id) {
    return await db.getAsync(`
      SELECT u.id, u.employee_code, u.username, u.full_name, u.email, u.phone, u.role, 
             u.department_id, u.position, u.birth_date, u.gender, u.qualification, 
             u.avatar, u.status, u.created_at,
             d.name as department_name, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `, [id]);
  },

  async findByIdWithPassword(id) {
    return await db.getAsync(`
      SELECT u.*, d.name as department_name, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `, [id]);
  },

  async findByUsername(username) {
    if (!username) return null;
    const cleanUsername = String(username).trim();
    return await db.getAsync(`
      SELECT u.*, d.name as department_name, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE LOWER(u.username) = LOWER(?)
    `, [cleanUsername]);
  },

  async findByEmployeeCode(employeeCode) {
    if (!employeeCode) return null;
    const cleanCode = String(employeeCode).trim();
    return await db.getAsync(`
      SELECT u.*, d.name as department_name, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE LOWER(u.employee_code) = LOWER(?)
    `, [cleanCode]);
  },

  async getNextEmployeeCode() {
    const lastUser = await db.getAsync(`SELECT MAX(id) as max_id FROM users`);
    const nextId = (lastUser?.max_id || 0) + 1;
    return `CB${String(nextId).padStart(4, '0')}`;
  },

  async updateSessionId(userId, sessionId) {
    try {
      const authMiddleware = require('../middleware/auth.middleware');
      if (authMiddleware.invalidateCache) authMiddleware.invalidateCache(userId);
    } catch (e) {}
    return await db.runAsync('UPDATE users SET current_session_id = ? WHERE id = ?', [sessionId, userId]);
  },

  async create(user) {
    return await db.runAsync(`
      INSERT INTO users (employee_code, username, password, full_name, email, phone, role, department_id, position, birth_date, gender, qualification, avatar, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user.employee_code || null, user.username, user.password, user.full_name, user.email || null, user.phone || null,
      user.role, user.department_id || null, user.position || null,
      user.birth_date || null, user.gender || 'Nam', user.qualification || 'Đại học',
      user.avatar || null, user.status || 'active'
    ]);
  },

  async update(id, fields) {
    try {
      const authMiddleware = require('../middleware/auth.middleware');
      if (authMiddleware.invalidateCache) authMiddleware.invalidateCache(id);
    } catch (e) {}
    const keys = Object.keys(fields);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = Object.values(fields);
    values.push(id);
    return await db.runAsync(`UPDATE users SET ${setClause} WHERE id = ?`, values);
  },

  async updateStatus(id, status) {
    try {
      const authMiddleware = require('../middleware/auth.middleware');
      if (authMiddleware.invalidateCache) authMiddleware.invalidateCache(id);
    } catch (e) {}
    return await db.runAsync('UPDATE users SET status = ? WHERE id = ?', [status, id]);
  },

  async updatePassword(id, hashedPassword) {
    return await db.runAsync('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
  },

  async delete(id) {
    return await db.runAsync('DELETE FROM users WHERE id = ?', [id]);
  }
};

module.exports = UserRepository;
