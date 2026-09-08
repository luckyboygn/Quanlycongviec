const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'agribank_work_tracking_jwt_secret_2026_super_secure',
  JWT_EXPIRES_IN: '24h',
  DB_PATH: path.join(__dirname, '../../data/tasks.db'),
  UPLOADS_DIR: path.join(__dirname, '../../uploads'),
  ROLES: {
    ADMIN: 'admin',
    DIRECTOR: 'director',
    MANAGER: 'manager',
    STAFF: 'staff',
    AUDITOR: 'auditor'
  },
  PRIORITIES: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
  },
  STATUSES: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    REVIEWING: 'reviewing',
    COMPLETED: 'completed',
    OVERDUE: 'overdue'
  }
};
