import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Missing env: DATABASE_URL");
}

// Parse the DATABASE_URL manually because the `pg` library has issues
// with Supabase pooler connection strings where the username contains
// a dot (e.g. postgres.projectref). Using explicit parameters instead.
function parseDbUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 5432,
    database: parsed.pathname.replace("/", ""),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

let pool: Pool | null = null;

export async function getDbPool(): Promise<Pool> {
  if (!pool) {
    const dbConfig = parseDbUrl(connectionString!);
    pool = new Pool({
      ...dbConfig,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on("error", (err) => {
      console.error("❌ DB Pool error:", err);
    });
  }
  return pool;
}
