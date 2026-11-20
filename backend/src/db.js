import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'opsflow_app',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'opsflow',
  connectionLimit: 5,
  waitForConnections: true,
  queueLimit: 50,
  connectTimeout: 5000,
  enableKeepAlive: true,
});

export async function dbReady() { await pool.query('SELECT 1'); }
