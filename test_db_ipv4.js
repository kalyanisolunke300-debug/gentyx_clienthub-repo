const { Pool } = require('pg');

async function testConnection() {
    // Try IPv4 direct connection if available
    const connectionString = "postgresql://postgres:%5BSaurabh%25031%5D@db.ipv4.gcsdiilorkuvtxfwncld.supabase.co:5432/postgres";

    console.log("Testing IPv4 Direct Host (masked password):", connectionString.replace(/:[^@]*@/, ":***@"));

    const pool = new Pool({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log("✔️ SUCCESS: Connected to database");
        const res = await client.query('SELECT NOW()');
        console.log("Current time from DB:", res.rows[0]);
        client.release();
    } catch (err) {
        console.error("❌ ERROR: Connection failed");
        console.error(err.message);
        if (err.detail) console.error("Detail:", err.detail);
    } finally {
        await pool.end();
    }
}

testConnection();
