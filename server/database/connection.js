const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { DB_PATH } = require('../config/constants');

const databaseUrl = process.env.DATABASE_URL;
let db = {};

if (databaseUrl) {
  console.log('🐘 Connecting to Cloud PostgreSQL Database...');
  
  const poolConfig = {
    connectionString: databaseUrl,
  };

  // Enable SSL if connecting to remote host (Render, AWS, Supabase, Neon)
  if (!databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1')) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool(poolConfig);
  db.isPostgres = true;
  db.pool = pool;

  function convertSqlToPg(sql) {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
  }

  db.runAsync = async function (sql, params = []) {
    let pgSql = convertSqlToPg(sql);
    const isInsert = /^\s*INSERT\s+INTO/i.test(pgSql);
    const hasReturning = /RETURNING/i.test(pgSql);
    if (isInsert && !hasReturning) {
      pgSql += ' RETURNING id';
    }
    const res = await pool.query(pgSql, params);
    return {
      lastID: res.rows && res.rows[0] ? res.rows[0].id : null,
      changes: res.rowCount
    };
  };

  db.getAsync = async function (sql, params = []) {
    const pgSql = convertSqlToPg(sql);
    const res = await pool.query(pgSql, params);
    return res.rows[0] || null;
  };

  db.allAsync = async function (sql, params = []) {
    const pgSql = convertSqlToPg(sql);
    const res = await pool.query(pgSql, params);
    return res.rows || [];
  };

} else {
  console.log('💾 Running with Local SQLite Database...');
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const sqliteDb = new sqlite3.Database(DB_PATH);
  sqliteDb.serialize(() => {
    sqliteDb.run('PRAGMA journal_mode = WAL;');
    sqliteDb.run('PRAGMA busy_timeout = 5000;');
    sqliteDb.run('PRAGMA synchronous = NORMAL;');
    sqliteDb.run('PRAGMA cache_size = -20000;');
    sqliteDb.run('PRAGMA temp_store = MEMORY;');
  });

  db.isPostgres = false;
  db.runAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  };

  db.getAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  };

  db.allAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  };
}

module.exports = db;

