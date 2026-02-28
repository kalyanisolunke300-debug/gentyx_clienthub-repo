const { Pool } = require('pg');

async function testConnection() {
    const configs = [
        {
            name: "Direct Host (IPv4, Literal Pass)",
            host: "db.ipv4.gcsdiilorkuvtxfwncld.supabase.co",
            user: "postgres",
            password: "[Saurabh%031]",
            port: 5432,
            database: "postgres"
        },
        {
            name: "Pooler Host (ap-south-1, 6543, Literal Pass)",
            host: "aws-0-ap-south-1.pooler.supabase.com",
            user: "postgres.gcsdiilorkuvtxfwncld",
            password: "[Saurabh%031]",
            port: 6543,
            database: "postgres"
        }
    ];

    for (const config of configs) {
        console.log(`\n--- Testing: ${config.name} ---`);
        const pool = new Pool({
            ...config,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000
        });

        try {
            const client = await pool.connect();
            console.log(`✔️ SUCCESS: Connected via ${config.name}`);
            client.release();
        } catch (err) {
            console.error(`❌ FAILED: ${config.name}`);
            console.error(`Message: ${err.message}`);
            if (err.detail) console.error(`Detail: ${err.detail}`);
        } finally {
            await pool.end();
        }
    }
}

testConnection();
