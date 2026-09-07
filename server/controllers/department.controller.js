const DepartmentRepository = require('../repositories/department.repository');
const { logActivity } = require('../utils/logger');

const DepartmentController = {
  async getAll(req, res) {
    try {
      const depts = await DepartmentRepository.findAll();
      res.json(depts);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi lấy danh sách phòng ban' });
    }
  },

  async create(req, res) {
    try {
      const { name, code, description } = req.body;
      if (!name || !code) {
        return res.status(400).json({ error: 'Vui lòng nhập tên và mã phòng ban' });
      }
      const existing = await DepartmentRepository.findByCode(code.toUpperCase());
      if (existing) {
        return res.status(400).json({ error: 'Mã phòng ban đã tồn tại trên hệ thống' });
      }

      const resId = await DepartmentRepository.create({ name, code: code.toUpperCase(), description });
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'CREATE_DEPARTMENT', 'departments', resId.lastID, `Tạo phòng ban: ${name} (${code})`, clientIp);

      const newDept = await DepartmentRepository.findById(resId.lastID);
      res.status(201).json(newDept);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi tạo phòng ban' });
    }
  },

  async update(req, res) {
    try {
      const deptId = parseInt(req.params.id);
      const { name, code, description } = req.body;
      await DepartmentRepository.update(deptId, { name, code: code.toUpperCase(), description });

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'UPDATE_DEPARTMENT', 'departments', deptId, `Cập nhật phòng: ${name}`, clientIp);

      const updated = await DepartmentRepository.findById(deptId);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi cập nhật phòng ban' });
    }
  },

  async delete(req, res) {
    try {
      const deptId = parseInt(req.params.id);
      await DepartmentRepository.delete(deptId);

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await logActivity(req.user.id, req.user.full_name, 'DELETE_DEPARTMENT', 'departments', deptId, `Xóa phòng ban ID: ${deptId}`, clientIp);

      res.json({ message: 'Đã xóa phòng ban thành công' });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi xóa phòng ban' });
    }
  }
};

module.exports = DepartmentController;
