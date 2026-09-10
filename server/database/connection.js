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
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
  };

  const isInternalRender = databaseUrl.includes('@dpg-') && !databaseUrl.includes('.render.com');
  const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');

  if (!isLocal && !isInternalRender && (databaseUrl.includes('.render.com') || databaseUrl.includes('sslmode=require') || databaseUrl.includes('supabase') || databaseUrl.includes('neon.tech'))) {
    poolConfig.ssl = { rejectUnauthorized: false };
  } else {
    poolConfig.ssl = false;
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
    const isAssignees = /task_assignees/i.test(pgSql);
    if (isInsert && !hasReturning && !isAssignees) {
      pgSql += ' RETURNING id';
    }
    const cleanParams = params.map(p => (p === '' ? null : p));
    try {
      const res = await pool.query(pgSql, cleanParams);
      return {
        lastID: res.rows && res.rows[0] ? res.rows[0].id : null,
        changes: res.rowCount
      };
    } catch (err) {
      if (err.message && err.message.includes('column "id" does not exist')) {
        const fallbackSql = convertSqlToPg(sql);
        const res = await pool.query(fallbackSql, cleanParams);
        return { lastID: null, changes: res.rowCount };
      }
      throw err;
    }
  };

  db.getAsync = async function (sql, params = []) {
    const pgSql = convertSqlToPg(sql);
    const cleanParams = params.map(p => (p === '' ? null : p));
    const res = await pool.query(pgSql, cleanParams);
    return res.rows[0] || null;
  };

  db.allAsync = async function (sql, params = []) {
    const pgSql = convertSqlToPg(sql);
    const cleanParams = params.map(p => (p === '' ? null : p));
    const res = await pool.query(pgSql, cleanParams);
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
    sqliteDb.run('PRAGMA busy_timeout = 10000;');
    sqliteDb.run('PRAGMA synchronous = NORMAL;');
    sqliteDb.run('PRAGMA cache_size = -64000;');
    sqliteDb.run('PRAGMA temp_store = MEMORY;');
    sqliteDb.run('PRAGMA mmap_size = 268435456;');
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

