const db = require('./server/database/connection');
const { initDB, checkAndUpdateOverdueTasks } = require('./server/database/schema');
const { logActivity, createNotification } = require('./server/utils/logger');

module.exports = {
  db,
  initDB,
  logActivity,
  createNotification,
  checkAndUpdateOverdueTasks
};
