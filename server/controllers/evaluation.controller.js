const EvaluationRepository = require('../repositories/evaluation.repository');
const db = require('../database/connection');
const { logActivity, createNotification } = require('../utils/logger');

function clamp(val, min, max) {
  if (val === undefined || val === null || isNaN(val)) return 0;
  return Math.min(max, Math.max(min, parseFloat(val) || 0));
}

function getUserEvaluationColumn(user) {
  const role = user.role || '';
  const pos = (user.position || '').toLowerCase();

  if (pos.includes('phó giám đốc') || pos.includes('phó trưởng đơn vị') || pos.includes('phó thủ trưởng')) {
    return 'deputy'; // Cột 3
  }
  if (role === 'director' || role === 'admin' || pos.includes('giám đốc') || pos.includes('trưởng đơn vị') || pos.includes('thủ trưởng')) {
    return 'head'; // Cột 4
  }
  if (role === 'manager' || pos.includes('phó phòng') || pos.includes('trưởng phòng') || pos.includes('lãnh đạo')) {
    return 'manager'; // Cột 2
  }
  return 'staff'; // Cột 1
}

const EvaluationController = {
  async getApprovers(req, res) {
    try {
      let deptId = req.user.department_id;
      if (req.query.user_id) {
        const targetUser = await db.getAsync('SELECT department_id FROM users WHERE id = ?', [req.query.user_id]);
        if (targetUser && targetUser.department_id) {
          deptId = targetUser.department_id;
        }
      }

      // 1. Department Leaders (Trưởng phòng, Phó phòng trong phòng ban)
      let deptLeaders = [];
      if (deptId) {
        deptLeaders = await db.allAsync(`
          SELECT id, full_name, position, role, department_id
          FROM users
          WHERE department_id = ? AND (status = 'active' OR status IS NULL)
            AND (role = 'manager' OR LOWER(position) LIKE '%trưởng phòng%' OR LOWER(position) LIKE '%phó phòng%' OR LOWER(position) LIKE '%phó trưởng%' OR LOWER(position) LIKE '%lãnh đạo%')
          ORDER BY id ASC
        `, [deptId]);
      }

      // If no managers found specifically in department, fallback to all department members or all managers
      if (!deptLeaders || deptLeaders.length === 0) {
        deptLeaders = await db.allAsync(`
          SELECT id, full_name, position, role, department_id
          FROM users
          WHERE (status = 'active' OR status IS NULL)
            AND (role = 'manager' OR LOWER(position) LIKE '%trưởng phòng%' OR LOWER(position) LIKE '%phó phòng%')
          ORDER BY department_id ASC, id ASC
        `);
      }

      // 2. Board of Directors (Giám đốc, Phó Giám đốc, Admin)
      const directors = await db.allAsync(`
        SELECT id, full_name, position, role, department_id
        FROM users
        WHERE (status = 'active' OR status IS NULL)
          AND (role IN ('director', 'admin') OR LOWER(position) LIKE '%giám đốc%' OR LOWER(position) LIKE '%phó giám đốc%' OR LOWER(position) LIKE '%thủ trưởng%')
        ORDER BY CASE WHEN LOWER(position) LIKE '%giám đốc%' AND LOWER(position) NOT LIKE '%phó%' THEN 1 ELSE 2 END, id ASC
      `);

      res.json({
        departmentLeaders: deptLeaders || [],
        boardOfDirectors: directors || []
      });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi lấy danh sách người duyệt: ' + err.message });
    }
  },

  async getMyEvaluation(req, res) {
    try {
      const now = new Date();
      const month = parseInt(req.query.month) || (now.getMonth() + 1);
      const year = parseInt(req.query.year) || now.getFullYear();
      
      let targetUserId = req.user.id;
      if (req.query.user_id) {
        const queryUserId = parseInt(req.query.user_id);
        // Managers, directors, admins can view others' evaluation sheets
        if (req.user.role === 'admin' || req.user.role === 'director' || req.user.role === 'manager') {
          targetUserId = queryUserId;
        }
      }

      const evaluation = await EvaluationRepository.findByUserAndPeriod(targetUserId, month, year);

      if (!evaluation) {
        // Find user info to return basic template
        const targetUser = await db.getAsync(`
          SELECT u.id, u.full_name, u.position, u.role, u.department_id, d.name as department_name
          FROM users u
          LEFT JOIN departments d ON u.department_id = d.id
          WHERE u.id = ?
        `, [targetUserId]);

        return res.json({
          user_id: targetUserId,
          full_name: targetUser ? targetUser.full_name : req.user.full_name,
          position: targetUser ? (targetUser.position || targetUser.role) : (req.user.position || req.user.role),
          department_name: targetUser ? (targetUser.department_name || 'Đơn vị') : (req.user.department_name || 'Đơn vị'),
          month,
          year,
          period_name: `Kỳ tạm ứng thù lao theo hiệu quả công việc V2 tháng ${month} năm ${year}`,
          score_volume: 0,
          score_quality: 0,
          score_progress: 0,
          score_attitude: 0,
          score_discipline: 0,
          score_test: 0,
          score_total: 0,
          mgr_score_volume: null,
          mgr_score_quality: null,
          mgr_score_progress: null,
          mgr_score_attitude: null,
          mgr_score_discipline: null,
          mgr_score_test: null,
          mgr_score_total: null,
          deputy_score_volume: null,
          deputy_score_quality: null,
          deputy_score_progress: null,
          deputy_score_attitude: null,
          deputy_score_discipline: null,
          deputy_score_test: null,
          deputy_score_total: null,
          head_score_volume: null,
          head_score_quality: null,
          head_score_progress: null,
          head_score_attitude: null,
          head_score_discipline: null,
          head_score_test: null,
          head_score_total: null,
          avg_score_total: 0,
          notes: '',
          mgr_notes: '',
          deputy_notes: '',
          head_notes: '',
          approver_mgr_id: null,
          approver_director_id: null,
          approver_mgr_name: null,
          approver_mgr_position: null,
          approver_director_name: null,
          approver_director_position: null,
          submitted_at: null,
          manager_approved_at: null,
          director_approved_at: null,
          submission_note: '',
          reject_reason: '',
          status: 'draft',
          is_new: true
        });
      }

      res.json(evaluation);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi lấy phiếu đánh giá: ' + err.message });
    }
  },

  async saveMyEvaluation(req, res) {
    try {
      const now = new Date();
      const month = parseInt(req.body.month) || (now.getMonth() + 1);
      const year = parseInt(req.body.year) || now.getFullYear();
      
      let targetUserId = req.user.id;
      if (req.body.user_id) {
        const queryUserId = parseInt(req.body.user_id);
        if (req.user.role === 'admin' || req.user.role === 'director' || req.user.role === 'manager') {
          targetUserId = queryUserId;
        }
      }

      const existingEval = await EvaluationRepository.findByUserAndPeriod(targetUserId, month, year);
      const userCol = getUserEvaluationColumn(req.user);
      const action = req.body.action || 'save'; // 'save', 'submit', 'recall', 'approve_manager', 'approve_director', 'reject'

      const evalData = {
        user_id: targetUserId,
        month,
        year,
        period_name: req.body.period_name || `Kỳ tạm ứng thù lao theo hiệu quả công việc V2 tháng ${month} năm ${year}`
      };

      // Approvers & Notes
      if (req.body.approver_mgr_id !== undefined) evalData.approver_mgr_id = req.body.approver_mgr_id ? parseInt(req.body.approver_mgr_id) : null;
      if (req.body.approver_director_id !== undefined) evalData.approver_director_id = req.body.approver_director_id ? parseInt(req.body.approver_director_id) : null;
      if (req.body.submission_note !== undefined) evalData.submission_note = (req.body.submission_note || '').trim();

      // 1. NHÂN VIÊN / CHUYÊN VIÊN -> KÊ CỘT 1 (NLĐ)
      if (userCol === 'staff' || req.user.id === targetUserId) {
        if (req.body.score_volume !== undefined || req.body.score_total !== undefined) {
          evalData.score_volume = clamp(req.body.score_volume, 0, 20);
          evalData.score_quality = clamp(req.body.score_quality, 0, 20);
          evalData.score_progress = clamp(req.body.score_progress, 0, 20);
          evalData.score_attitude = clamp(req.body.score_attitude, 0, 20);
          evalData.score_discipline = clamp(req.body.score_discipline, 0, 10);
          evalData.score_test = clamp(req.body.score_test, 0, 10);
          evalData.score_total = parseFloat((evalData.score_volume + evalData.score_quality + evalData.score_progress + evalData.score_attitude + evalData.score_discipline + evalData.score_test).toFixed(2));
          if (req.body.notes !== undefined) evalData.notes = (req.body.notes || '').trim();
        }
      } 
      
      // 2. LÃNH ĐẠO PHÒNG (Trưởng phòng, Phó phòng) -> KÊ CỘT 2
      if (userCol === 'manager' || req.user.role === 'admin' || req.user.role === 'director') {
        if (req.body.mgr_score_volume !== undefined || req.body.mgr_score_total !== undefined) {
          evalData.mgr_score_volume = clamp(req.body.mgr_score_volume, 0, 20);
          evalData.mgr_score_quality = clamp(req.body.mgr_score_quality, 0, 20);
          evalData.mgr_score_progress = clamp(req.body.mgr_score_progress, 0, 20);
          evalData.mgr_score_attitude = clamp(req.body.mgr_score_attitude, 0, 20);
          evalData.mgr_score_discipline = clamp(req.body.mgr_score_discipline, 0, 10);
          evalData.mgr_score_test = clamp(req.body.mgr_score_test, 0, 10);
          evalData.mgr_score_total = parseFloat((evalData.mgr_score_volume + evalData.mgr_score_quality + evalData.mgr_score_progress + evalData.mgr_score_attitude + evalData.mgr_score_discipline + evalData.mgr_score_test).toFixed(2));
          if (req.body.mgr_notes !== undefined) evalData.mgr_notes = (req.body.mgr_notes || '').trim();
        }
      } 
      
      // 3. PHÓ TRƯỞNG ĐƠN VỊ (Phó Giám đốc) -> KÊ CỘT 3
      if (userCol === 'deputy' || req.user.role === 'admin' || req.user.role === 'director') {
        if (req.body.deputy_score_volume !== undefined || req.body.deputy_score_total !== undefined) {
          evalData.deputy_score_volume = clamp(req.body.deputy_score_volume, 0, 20);
          evalData.deputy_score_quality = clamp(req.body.deputy_score_quality, 0, 20);
          evalData.deputy_score_progress = clamp(req.body.deputy_score_progress, 0, 20);
          evalData.deputy_score_attitude = clamp(req.body.deputy_score_attitude, 0, 20);
          evalData.deputy_score_discipline = clamp(req.body.deputy_score_discipline, 0, 10);
          evalData.deputy_score_test = clamp(req.body.deputy_score_test, 0, 10);
          evalData.deputy_score_total = parseFloat((evalData.deputy_score_volume + evalData.deputy_score_quality + evalData.deputy_score_progress + evalData.deputy_score_attitude + evalData.deputy_score_discipline + evalData.deputy_score_test).toFixed(2));
          if (req.body.deputy_notes !== undefined) evalData.deputy_notes = (req.body.deputy_notes || '').trim();
        }
      } 
      
      // 4. TRƯỞNG ĐƠN VỊ (Giám đốc, Admin) -> KÊ CỘT 4
      if (userCol === 'head' || req.user.role === 'admin' || req.user.role === 'director') {
        if (req.body.head_score_volume !== undefined || req.body.head_score_total !== undefined) {
          evalData.head_score_volume = clamp(req.body.head_score_volume, 0, 20);
          evalData.head_score_quality = clamp(req.body.head_score_quality, 0, 20);
          evalData.head_score_progress = clamp(req.body.head_score_progress, 0, 20);
          evalData.head_score_attitude = clamp(req.body.head_score_attitude, 0, 20);
          evalData.head_score_discipline = clamp(req.body.head_score_discipline, 0, 10);
          evalData.head_score_test = clamp(req.body.head_score_test, 0, 10);
          evalData.head_score_total = parseFloat((evalData.head_score_volume + evalData.head_score_quality + evalData.head_score_progress + evalData.head_score_attitude + evalData.head_score_discipline + evalData.head_score_test).toFixed(2));
          if (req.body.head_notes !== undefined) evalData.head_notes = (req.body.head_notes || '').trim();
        }
      }

      // Fetch target user for notification messages
      const targetUser = await db.getAsync('SELECT id, full_name FROM users WHERE id = ?', [targetUserId]);
      const targetName = targetUser ? targetUser.full_name : req.user.full_name;

      // WORKFLOW ACTION PROCESSING
      let message = 'Lưu phiếu đánh giá thành công';

      if (action === 'submit') {
        evalData.status = 'pending_manager';
        evalData.submitted_at = new Date().toISOString();
        evalData.reject_reason = null;
        message = 'Đã chuyển phiếu đánh giá đến Lãnh đạo phòng duyệt thành công!';

        const mgrId = evalData.approver_mgr_id || (existingEval && existingEval.approver_mgr_id);
        if (mgrId) {
          await createNotification(
            mgrId,
            'Phiếu đánh giá mới cần duyệt',
            `Cán bộ ${targetName} đã gửi chuyển duyệt phiếu đánh giá Mẫu 01A tháng ${month}/${year}.`,
            'task',
            targetUserId
          );
        }
      } else if (action === 'recall') {
        evalData.status = 'draft';
        message = 'Đã thu hồi phiếu đánh giá về trạng thái bản nháp thành công!';
      } else if (action === 'approve_manager') {
        evalData.status = 'pending_director';
        evalData.manager_approved_at = new Date().toISOString();
        evalData.reject_reason = null;
        message = 'Lãnh đạo phòng đã duyệt và chuyển phiếu lên Ban Giám đốc phê duyệt thành công!';

        const dirId = evalData.approver_director_id || (existingEval && existingEval.approver_director_id);
        if (dirId) {
          await createNotification(
            dirId,
            'Phiếu đánh giá chờ BGĐ phê duyệt',
            `Lãnh đạo phòng đã duyệt và chuyển phiếu đánh giá tháng ${month}/${year} của cán bộ ${targetName} lên Ban Giám đốc.`,
            'task',
            targetUserId
          );
        }
        await createNotification(
          targetUserId,
          'Phiếu đánh giá đã qua cấp phòng',
          `Lãnh đạo phòng đã hoàn tất đánh giá và chuyển phiếu tháng ${month}/${year} của bạn lên Ban Giám đốc.`,
          'info',
          targetUserId
        );
      } else if (action === 'approve_director') {
        evalData.status = 'approved';
        evalData.director_approved_at = new Date().toISOString();
        evalData.reject_reason = null;
        message = 'Ban Giám đốc đã phê duyệt chính thức phiếu đánh giá thành công!';

        await createNotification(
          targetUserId,
          'Phiếu đánh giá đã được phê duyệt',
          `🎉 Ban Giám đốc đã chính thức phê duyệt phiếu đánh giá Mẫu 01A tháng ${month}/${year} của bạn.`,
          'success',
          targetUserId
        );
        const mgrId = evalData.approver_mgr_id || (existingEval && existingEval.approver_mgr_id);
        if (mgrId && mgrId !== req.user.id) {
          await createNotification(
            mgrId,
            'Phiếu đánh giá đã hoàn tất phê duyệt',
            `Ban Giám đốc đã hoàn tất phê duyệt phiếu đánh giá tháng ${month}/${year} của cán bộ ${targetName}.`,
            'success',
            targetUserId
          );
        }
      } else if (action === 'reject') {
        evalData.status = 'rejected';
        evalData.reject_reason = (req.body.reject_reason || '').trim() || 'Yêu cầu rà soát và chỉnh sửa lại theo ý kiến lãnh đạo';
        message = 'Đã trả lại phiếu đánh giá yêu cầu cán bộ chỉnh sửa!';

        await createNotification(
          targetUserId,
          'Phiếu đánh giá yêu cầu chỉnh sửa',
          `⚠️ Phiếu đánh giá tháng ${month}/${year} của bạn đã bị trả lại. Lý do: "${evalData.reject_reason}"`,
          'warning',
          targetUserId
        );
      } else {
        if (req.body.status) {
          evalData.status = req.body.status;
        }
      }

      const evalId = await EvaluationRepository.upsert(evalData);
      const saved = await EvaluationRepository.findById(evalId);

      await logActivity(req.user.id, req.user.full_name || 'System', 'EVALUATION_SAVE', 'evaluations', evalId, `${action.toUpperCase()}: tháng ${month}/${year} cho user #${targetUserId}`);

      res.json({ message, evaluation: saved });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi lưu phiếu đánh giá: ' + err.message });
    }
  },

  async getEvaluations(req, res) {
    try {
      const now = new Date();
      const month = parseInt(req.query.month) || (now.getMonth() + 1);
      const year = parseInt(req.query.year) || now.getFullYear();
      let departmentId = req.query.department_id || null;

      // Restrict managers to their own department
      if (req.user.role === 'manager') {
        departmentId = req.user.department_id;
      }

      const list = await EvaluationRepository.getByDepartment(departmentId, month, year);
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi lấy danh sách đánh giá: ' + err.message });
    }
  }
};

module.exports = EvaluationController;
