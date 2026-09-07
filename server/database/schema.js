const db = require('./connection');
const bcrypt = require('bcryptjs');

async function initDB() {
  await db.runAsync('PRAGMA foreign_keys = ON');

  // 1. Departments table (5 phòng ban của Trường Đào tạo cán bộ Agribank)
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Users table (4 vai trò: admin, director, manager, staff)
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT NOT NULL CHECK(role IN ('admin', 'director', 'manager', 'staff')),
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      position TEXT,
      birth_date DATE,
      gender TEXT DEFAULT 'Nam',
      qualification TEXT DEFAULT 'Đại học',
      avatar TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'locked')),
      current_session_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try { await db.runAsync(`ALTER TABLE users ADD COLUMN birth_date DATE`); } catch (e) {}
  try { await db.runAsync(`ALTER TABLE users ADD COLUMN gender TEXT DEFAULT 'Nam'`); } catch (e) {}
  try { await db.runAsync(`ALTER TABLE users ADD COLUMN qualification TEXT DEFAULT 'Đại học'`); } catch (e) {}
  try { await db.runAsync(`ALTER TABLE users ADD COLUMN current_session_id TEXT`); } catch (e) {}
  try { await db.runAsync(`ALTER TABLE users ADD COLUMN employee_code TEXT`); } catch (e) {}

  // 3. Tasks table
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'reviewing', 'completed', 'overdue')),
      progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
      start_date DATE NOT NULL,
      due_date DATE NOT NULL,
      completed_at DATETIME,
      attachment_links TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Task Assignees table
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS task_assignees (
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      is_leader INTEGER DEFAULT 0,
      PRIMARY KEY (task_id, user_id)
    )
  `);

  // 5. Task Daily Logs table
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS task_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      log_date DATE NOT NULL,
      progress_percent INTEGER,
      note TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 6. Reports table
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      type TEXT NOT NULL CHECK(type IN ('daily', 'weekly', 'monthly')),
      report_date DATE NOT NULL,
      title TEXT NOT NULL,
      content_done TEXT NOT NULL,
      content_inprogress TEXT,
      content_issues TEXT,
      tasks_summary TEXT,
      status TEXT DEFAULT 'submitted' CHECK(status IN ('submitted', 'approved', 'rejected', 'revision_requested')),
      reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      review_comment TEXT,
      reviewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 7. Notifications table
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      related_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 8. Activity Logs table
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 9. Personal Work Logs table
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS personal_work_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      task_name TEXT,
      title TEXT NOT NULL,
      activity_type TEXT DEFAULT 'Công tác chuyên môn',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      start_time TEXT,
      end_time TEXT,
      hours_spent REAL DEFAULT 8.0,
      location TEXT DEFAULT 'Tại Trường ĐT CB Agribank',
      description TEXT NOT NULL,
      result_outcome TEXT,
      attachment_url TEXT,
      status TEXT DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed')),
      auto_complete INTEGER DEFAULT 1,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try { await db.runAsync(`ALTER TABLE personal_work_logs ADD COLUMN task_name TEXT`); } catch (e) {}
  try { await db.runAsync(`ALTER TABLE personal_work_logs ADD COLUMN start_time TEXT`); } catch (e) {}
  try { await db.runAsync(`ALTER TABLE personal_work_logs ADD COLUMN end_time TEXT`); } catch (e) {}
  try { await db.runAsync(`ALTER TABLE personal_work_logs ADD COLUMN status TEXT DEFAULT 'in_progress'`); } catch (e) {}
  try { await db.runAsync(`ALTER TABLE personal_work_logs ADD COLUMN auto_complete INTEGER DEFAULT 1`); } catch (e) {}
  try { await db.runAsync(`ALTER TABLE personal_work_logs ADD COLUMN completed_at DATETIME`); } catch (e) {}
  try { await db.runAsync(`ALTER TABLE personal_work_logs ADD COLUMN approval_status TEXT DEFAULT 'pending'`); } catch (e) {}
  try { await db.runAsync(`ALTER TABLE personal_work_logs ADD COLUMN approved_by INTEGER`); } catch (e) {}
  try { await db.runAsync(`ALTER TABLE personal_work_logs ADD COLUMN approved_at DATETIME`); } catch (e) {}
  try { await db.runAsync(`ALTER TABLE personal_work_logs ADD COLUMN approval_comment TEXT`); } catch (e) {}

  // 10. Messages table
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      channel TEXT DEFAULT 'direct',
      content TEXT NOT NULL,
      attachment_url TEXT,
      attachment_name TEXT,
      is_read INTEGER DEFAULT 0,
      is_recalled INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try { await db.runAsync(`ALTER TABLE messages ADD COLUMN is_recalled INTEGER DEFAULT 0`); } catch (e) {}

  try {
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_msg_sender ON messages(sender_id)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_msg_receiver ON messages(receiver_id)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_msg_channel ON messages(channel)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_logs_user_date ON personal_work_logs(user_id, start_date)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_tasks_dept_status ON tasks(department_id, status)`);
  } catch (e) {}

  // 11. News & Activity Bulletin Board table
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      category TEXT DEFAULT 'Thông báo',
      badge_color TEXT DEFAULT 'emerald',
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT,
      is_pinned INTEGER DEFAULT 0,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    const newsCount = await db.getAsync('SELECT COUNT(*) as count FROM news');
    if (!newsCount || newsCount.count === 0) {
      const seedNews = [
        {
          title: 'Kế hoạch triển khai công tác đào tạo cán bộ nguồn Quý IV/2026',
          summary: 'Trường Đào tạo cán bộ Agribank thông báo kế hoạch tổ chức các lớp bồi dưỡng nghiệp vụ chuyên sâu và kỹ năng lãnh đạo Quý IV/2026.',
          content: 'Căn cứ phê duyệt của Ban Lãnh đạo Agribank, Trường Đào tạo cán bộ triển khai kế hoạch đào tạo Quý IV/2026 cho các Chi nhánh trên toàn quốc. Yêu cầu các Phòng chuyên môn (QLĐT-TV, NCGD, Kế hoạch, Kế toán, Tổng hợp) khẩn trương hoàn thiện giáo trình, lịch giảng viên và điều kiện cơ sở vật chất.',
          category: 'Thông báo',
          badge_color: 'emerald',
          author_name: 'Ban Giám đốc & Phòng QLĐT',
          is_pinned: 1
        },
        {
          title: 'Hội thi Giảng viên dạy giỏi toàn hệ thống Agribank năm 2026',
          summary: 'Phát động phong trào thi đua dạy tốt - học tốt và đổi mới phương pháp giảng dạy hiện đại trong toàn thể giảng viên của Trường.',
          content: 'Nhằm nâng cao chất lượng đào tạo và ứng dụng công nghệ trong giảng dạy số, Nhà trường phát động Hội thi Giảng viên dạy giỏi năm 2026. Tất cả giảng viên cơ hữu và kiêm chức của Trường tích cực đăng ký tham gia các chuyên đề đổi mới sáng tạo.',
          category: 'Sự kiện nổi bật',
          badge_color: 'amber',
          author_name: 'Phòng Nghiên cứu - Giảng dạy',
          is_pinned: 1
        },
        {
          title: 'Chỉ đạo tăng cường kỷ cương kê khai nhật ký và tiến độ nhiệm vụ các phòng ban',
          summary: 'Ban Giám hiệu yêu cầu tất cả cán bộ, nhân viên duy trì nghiêm túc việc kê khai giờ công và cập nhật tiến độ công việc hàng ngày.',
          content: 'Để phục vụ đánh giá KPI chính xác và phục vụ công tác giao ban định kỳ, đề nghị toàn thể cán bộ 5 phòng ban tự kê khai nhật ký đúng khung giờ, cập nhật tiến độ việc giao trên hệ thống trước 17h00 hàng ngày.',
          category: 'Chỉ đạo điều hành',
          badge_color: 'rose',
          author_name: 'Ban Giám đốc',
          is_pinned: 0
        }
      ];

      for (const item of seedNews) {
        await db.runAsync(
          `INSERT INTO news (title, summary, content, category, badge_color, author_name, is_pinned)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [item.title, item.summary, item.content, item.category, item.badge_color, item.author_name, item.is_pinned]
        );
      }
    }
  } catch (e) {
    console.error('Error seeding news:', e);
  }

  await checkAndUpdateOverdueTasks();
  console.log('✓ Database initialized and ready for Trường Đào tạo cán bộ Agribank.');
}

async function checkAndUpdateOverdueTasks() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const overdueTasks = await db.allAsync(
      `SELECT id, title, due_date FROM tasks 
       WHERE due_date < ? AND status NOT IN ('completed', 'overdue')`,
      [today]
    );

    for (const task of overdueTasks) {
      await db.runAsync(
        `UPDATE tasks SET status = 'overdue', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [task.id]
      );
      
      const assignees = await db.allAsync(
        `SELECT user_id FROM task_assignees WHERE task_id = ?`,
        [task.id]
      );
      for (const a of assignees) {
        await db.runAsync(
          `INSERT INTO notifications (user_id, title, content, type, related_id)
           VALUES (?, ?, ?, ?, ?)`,
          [
            a.user_id,
            'Cảnh báo quá hạn công việc',
            `Công việc "${task.title}" đã quá hạn vào ngày ${task.due_date}. Vui lòng cập nhật ngay!`,
            'overdue',
            task.id
          ]
        );
      }
    }
  } catch (err) {
    console.error('Error updating overdue tasks:', err);
  }
}

module.exports = {
  initDB,
  checkAndUpdateOverdueTasks
};
