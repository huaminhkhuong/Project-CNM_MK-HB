const mysql = require("mysql2/promise");
const { env } = require("./env");

let pool;

function getPoolConfig() {
  const dbUrl = process.env.DATABASE_URL || env.databaseUrl;
  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      return {
        host: parsed.hostname || "127.0.0.1",
        port: Number(parsed.port || 3306),
        user: decodeURIComponent(parsed.username || "root"),
        password: decodeURIComponent(parsed.password || ""),
        database: parsed.pathname.replace(/^\//, "") || "cnm_ecommerce"
      };
    } catch {
      // fallback to env properties if URL parsing fails
    }
  }

  return {
    host: process.env.DB_HOST || env.dbHost || "127.0.0.1",
    port: Number(process.env.DB_PORT || env.dbPort || 3306),
    user: process.env.DB_USER || env.dbUser || "root",
    password: process.env.DB_PASSWORD ?? env.dbPassword ?? "",
    database: process.env.DB_NAME || env.dbName || "cnm_ecommerce"
  };
}

function createPool() {
  const config = getPoolConfig();
  const nextPool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  nextPool.on("connection", (connection) => {
    connection.query("SET time_zone = '+07:00'");
  });

  return nextPool;
}

function getDbPool() {
  if (!pool) {
    pool = createPool();
  }

  return pool;
}

async function testConnection() {
  const connection = await getDbPool().getConnection();

  try {
    await connection.ping();

    return {
      success: true,
      message: "MySQL connection established successfully"
    };
  } finally {
    connection.release();
  }
}

async function query(sql, params = []) {
  const [rows] = await getDbPool().execute(sql, params);
  return rows;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getDbPool,
  testConnection,
  query,
  closePool
};
