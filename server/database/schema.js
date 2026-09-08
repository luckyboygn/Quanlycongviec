const db = require('./connection');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function execTable(sql) {
  let finalSql = sql;
  if (db.isPostgres) {
    finalSql = finalSql
      .replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
      .replace(/DATETIME/gi, 'TIMESTAMP');
  }
  await db.runAsync(finalSql);
}

async function safeAddColumn(table, column, typeDef) {
  try {
    if (db.isPostgres) {
      await db.runAsync(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${typeDef}`);
    } else {
      await db.runAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`);
    }
  } catch (e) {}
}

async function initDB() {
  if (!db.isPostgres) {
    try { await db.runAsync('PRAGMA foreign_keys = ON'); } catch (e) {}
  }

  // 1. Departments table (5 phòng ban của Trường Đào tạo cán bộ Agribank)
  await execTable(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Users table (4 vai trò: admin, director, manager, staff)
  await execTable(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT NOT NULL CHECK(role IN ('admin', 'director', 'manager', 'staff', 'auditor')),
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      position TEXT,
      birth_date DATE,
      gender TEXT DEFAULT 'Nam',
      qualification TEXT DEFAULT 'Đại học',
      avatar TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'locked')),
      current_session_id TEXT,
      employee_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await safeAddColumn('users', 'birth_date', 'DATE');
  await safeAddColumn('users', 'gender', "TEXT DEFAULT 'Nam'");
  await safeAddColumn('users', 'qualification', "TEXT DEFAULT 'Đại học'");
  await safeAddColumn('users', 'current_session_id', 'TEXT');
  await safeAddColumn('users', 'employee_code', 'TEXT');

  // 3. Tasks table
  await execTable(`
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
  await execTable(`
    CREATE TABLE IF NOT EXISTS task_assignees (
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      is_leader INTEGER DEFAULT 0,
      PRIMARY KEY (task_id, user_id)
    )
  `);

  // 5. Task Daily Logs table
  await execTable(`
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
  await execTable(`
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
  await execTable(`
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
  await execTable(`
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
  await execTable(`
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
      approval_status TEXT DEFAULT 'pending',
      approved_by INTEGER,
      approved_at DATETIME,
      approval_comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await safeAddColumn('personal_work_logs', 'task_name', 'TEXT');
  await safeAddColumn('personal_work_logs', 'start_time', 'TEXT');
  await safeAddColumn('personal_work_logs', 'end_time', 'TEXT');
  await safeAddColumn('personal_work_logs', 'status', "TEXT DEFAULT 'in_progress'");
  await safeAddColumn('personal_work_logs', 'auto_complete', 'INTEGER DEFAULT 1');
  await safeAddColumn('personal_work_logs', 'completed_at', 'DATETIME');
  await safeAddColumn('personal_work_logs', 'approval_status', "TEXT DEFAULT 'pending'");
  await safeAddColumn('personal_work_logs', 'approved_by', 'INTEGER');
  await safeAddColumn('personal_work_logs', 'approved_at', 'DATETIME');
  await safeAddColumn('personal_work_logs', 'approval_comment', 'TEXT');
  await safeAddColumn('personal_work_logs', 'supervisor_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');

  // 10. Messages table
  await execTable(`
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

  await safeAddColumn('messages', 'is_recalled', 'INTEGER DEFAULT 0');

  try {
    // Indexes on messages
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_msg_sender_receiver ON messages(sender_id, receiver_id, created_at)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_msg_receiver_sender ON messages(receiver_id, sender_id, created_at)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_msg_receiver_read ON messages(receiver_id, is_read)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_msg_channel_created ON messages(channel, created_at)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_msg_created_at ON messages(created_at)`);

    // Indexes on personal work logs
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_pwl_user_dates ON personal_work_logs(user_id, start_date, end_date)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_pwl_dept_user ON personal_work_logs(department_id, user_id)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_pwl_supervisor ON personal_work_logs(supervisor_id, approval_status)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_pwl_auto_complete ON personal_work_logs(status, auto_complete, end_date)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_pwl_status_dates ON personal_work_logs(status, start_date, end_date)`);

    // Indexes on tasks & task assignees
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_tasks_dept_status_due ON tasks(department_id, status, due_date)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(user_id, task_id)`);

    // Indexes on notifications & users
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications(user_id, is_read, created_at)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_users_dept_status ON users(department_id, status)`);
  } catch (e) {}

  // 11. News & Activity Bulletin Board table
  await execTable(`
    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      category TEXT DEFAULT 'Lịch công tác',
      badge_color TEXT DEFAULT 'emerald',
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT,
      is_pinned INTEGER DEFAULT 0,
      image_url TEXT,
      news_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await safeAddColumn('news', 'news_date', 'TEXT');

  // AUTO SEED IF EMPTY
  try {
    const userCount = await db.getAsync('SELECT COUNT(*) as count FROM users');
    if (!userCount || parseInt(userCount.count) === 0) {
      console.log('🌱 Empty database detected! Performing initial seed from seed_data.json...');
      const seedPath = path.join(__dirname, 'seed_data.json');
      if (fs.existsSync(seedPath)) {
        const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
        
        // 1. Departments
        if (seed.departments && seed.departments.length > 0) {
          for (const d of seed.departments) {
            await db.runAsync(
              `INSERT INTO departments (id, name, code, description) VALUES (?, ?, ?, ?)`,
              [d.id, d.name, d.code, d.description]
            );
          }
          if (db.isPostgres) {
            try { await db.runAsync(`SELECT setval('departments_id_seq', (SELECT COALESCE(MAX(id), 1) FROM departments))`); } catch (e) {}
          }
        }

        // 2. Users
        if (seed.users && seed.users.length > 0) {
          for (const u of seed.users) {
            const birthDate = (u.birth_date && String(u.birth_date).trim() !== '') ? String(u.birth_date).trim() : null;
            await db.runAsync(
              `INSERT INTO users (id, employee_code, username, password, full_name, email, phone, role, department_id, position, birth_date, gender, qualification, avatar, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                u.id, u.employee_code || null, u.username, u.password, u.full_name, u.email || null, u.phone || null,
                u.role, u.department_id || null, u.position || null, birthDate, u.gender || 'Nam',
                u.qualification || 'Đại học', u.avatar || null, u.status || 'active'
              ]
            );
          }
          if (db.isPostgres) {
            try { await db.runAsync(`SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users))`); } catch (e) {}
          }
        }

        // 3. News
        if (seed.news && seed.news.length > 0) {
          for (const n of seed.news) {
            await db.runAsync(
              `INSERT INTO news (id, title, summary, content, category, badge_color, author_name, is_pinned)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [n.id, n.title, n.summary, n.content, n.category, n.badge_color, n.author_name, n.is_pinned || 0]
            );
          }
          if (db.isPostgres) {
            try { await db.runAsync(`SELECT setval('news_id_seq', (SELECT COALESCE(MAX(id), 1) FROM news))`); } catch (e) {}
          }
        }

        console.log('✅ Seed completed successfully: 5 departments, ' + (seed.users?.length || 0) + ' official users.');
      }
    }

    // 4. Ensure dedicated Auditor user exists across SQLite and Cloud PostgreSQL
    if (db.isPostgres) {
      try {
        await db.runAsync(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
        await db.runAsync(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'director', 'manager', 'staff', 'auditor'))`);
      } catch (e) {
        // Ignore if constraint already handled
      }
    }

    const existingAuditor = await db.getAsync("SELECT id, username, password, role FROM users WHERE username = 'kiemtra'");
    const hash123456 = await bcrypt.hash('123456', 10);
    if (!existingAuditor) {
      await db.runAsync(
        `INSERT INTO users (employee_code, username, password, full_name, email, phone, role, position, status, qualification, gender)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'AGB-KTGS',
          'kiemtra',
          hash123456,
          'Cán bộ Kiểm tra & Giám sát',
          'kiemtra@agribank.com.vn',
          '0900.000.000',
          'auditor',
          'Cán bộ Kiểm tra',
          'active',
          'Đại học',
          'Nam'
        ]
      );
      console.log('✅ Created auditor user: kiemtra / 123456');
    } else {
      await db.runAsync(
        `UPDATE users SET role = 'auditor', status = 'active', password = ?, full_name = 'Cán bộ Kiểm tra & Giám sát', employee_code = 'AGB-KTGS' WHERE username = 'kiemtra'`,
        [hash123456]
      );
      console.log('✅ Verified auditor user: kiemtra / 123456');
    }

    // 5. Convert any legacy hours in personal_work_logs (<= 24) to minutes (* 60)
    try {
      await db.runAsync(`UPDATE personal_work_logs SET hours_spent = hours_spent * 60 WHERE hours_spent <= 24 AND hours_spent > 0`);
    } catch (e) {}
  } catch (seedErr) {
    console.error('Error checking/seeding database:', seedErr);
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

