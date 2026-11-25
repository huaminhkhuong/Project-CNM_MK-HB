import mysql, { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { env } from "./env";

let pool: Pool | null = null;

interface PoolConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}

function getPoolConfig(): PoolConfig {
  const dbUrl = process.env.DATABASE_URL || env.databaseUrl;
  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      return {
        host: parsed.hostname || "127.0.0.1",
        port: Number(parsed.port || 3306),
        user: decodeURIComponent(parsed.username || "root"),
        password: decodeURIComponent(parsed.password || ""),
        database: parsed.pathname.replace(/^\//, "") || "cnm_mk_hb"
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
    database: process.env.DB_NAME || env.dbName || "cnm_mk_hb"
  };
}

function createPool(): Pool {
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

  const originalEnd = nextPool.end.bind(nextPool);
  nextPool.end = async function (...args) {
    if (pool === nextPool) {
      pool = null;
    }
    return originalEnd(...args);
  };

  nextPool.on("connection", (connection) => {
    connection.query("SET time_zone = '+07:00'");
  });

  return nextPool;
}

export function getDbPool(): Pool {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

export async function testConnection(): Promise<{ success: boolean; message: string }> {
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

export async function query<T = any>(sql: string, params: any[] = []): Promise<T> {
  const [rows] = await getDbPool().execute(sql, params);
  return rows as T;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export default {
  getDbPool,
  testConnection,
  query,
  closePool
};
