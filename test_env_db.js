const { Pool } = require('pg');

async function testConnection() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error("❌ ERROR: DATABASE_URL not set.");
        return;
    }

    console.log("Testing current DATABASE_URL (masked):", connectionString.replace(/:[^@]*@/, ":***@"));

    const pool = new Pool({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log("✔️ SUCCESS: Database connected!");
        const res = await client.query('SELECT NOW()');
        console.log("Current time from DB:", res.rows[0]);
        client.release();
    } catch (err) {
        console.error("❌ ERROR: Connection failed");
        console.error("Message:", err.message);
        if (err.detail) console.error("Detail:", err.detail);
    } finally {
        await pool.end();
    }
}

testConnection();
