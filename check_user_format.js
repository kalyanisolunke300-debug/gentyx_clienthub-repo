const { Pool } = require('pg');

async function check() {
    const host = "db.gcsdiilorkuvtxfwncld.supabase.co";
    const user = "postgres.gcsdiilorkuvtxfwncld"; // Pooler format
    const pass = "[Tushar%0099]"; // Literal variant
    const database = "postgres";

    console.log(`\n--- Testing with user ${user} on host ${host} ---`);
    const pool = new Pool({
        host,
        user,
        password: pass,
        database,
        port: 5432,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
    });

    try {
        const client = await pool.connect();
        console.log(`✔️ SUCCESS: Connected!`);
        client.release();
    } catch (err) {
        console.error(`❌ FAILED`);
        console.error(`Message: ${err.message}`);
    } finally {
        await pool.end();
    }
}

check();
