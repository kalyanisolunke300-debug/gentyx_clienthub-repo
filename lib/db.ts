// lib/db.ts
import sql from "mssql";

const config: sql.config = {
  user: process.env.AZURE_SQL_USERNAME,
  password: process.env.AZURE_SQL_PASSWORD,
  server: process.env.AZURE_SQL_SERVER as string,
  database: process.env.AZURE_SQL_DATABASE,
  options: {
    encrypt: true,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getDbPool() {
  if (pool) return pool;

  try {
    pool = await sql.connect(config);
    console.log("✔️ DB Connected");
    return pool;
  } catch (err) {
    console.error("❌ DB Connection Error:", err);
    throw err;
  }
}
