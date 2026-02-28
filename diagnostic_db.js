const { Pool } = require('pg');

async function testConnection() {
    // Variant 1: Direct Connection
    const variants = [
        {
            name: "Direct Host",
            connectionString: "postgresql://postgres:%5BSaurabh%25031%5D@db.gcsdiilorkuvtxfwncld.supabase.co:5432/postgres"
        },
        {
            name: "Pooler (ap-east-2, 6543)",
            connectionString: "postgresql://postgres.gcsdiilorkuvtxfwncld:%5BSaurabh%25031%5D@aws-0-ap-east-2.pooler.supabase.com:6543/postgres"
        },
        {
            name: "Pooler (ap-east-2, 5432)",
            connectionString: "postgresql://postgres.gcsdiilorkuvtxfwncld:%5BSaurabh%25031%5D@aws-0-ap-east-2.pooler.supabase.com:5432/postgres?pgbouncer=true"
        },
        {
            name: "Pooler (us-east-1, 6543)",
            connectionString: "postgresql://postgres.gcsdiilorkuvtxfwncld:%5BSaurabh%25031%5D@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
        },
        {
            name: "Pooler (ap-southeast-1, 6543)",
            connectionString: "postgresql://postgres.gcsdiilorkuvtxfwncld:%5BSaurabh%25031%5D@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
        },
        {
            name: "Pooler Host (ap-south-1)",
            connectionString: "postgresql://postgres.gcsdiilorkuvtxfwncld:%5BSaurabh%25031%5D@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
        },
        {
            name: "Pooler Host (ap-south-1, 6543)",
            connectionString: "postgresql://postgres.gcsdiilorkuvtxfwncld:%5BSaurabh%25031%5D@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
        }
    ];

    for (const variant of variants) {
        console.log(`\n--- Testing: ${variant.name} ---`);
        const pool = new Pool({
            connectionString: variant.connectionString,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000
        });

        try {
            const client = await pool.connect();
            console.log(`✔️ SUCCESS: Connected via ${variant.name}`);
            client.release();
            break;
        } catch (err) {
            console.error(`❌ FAILED: ${variant.name}`);
            console.error(`Message: ${err.message}`);
            if (err.detail) console.error(`Detail: ${err.detail}`);
        } finally {
            await pool.end();
        }
    }
}

testConnection();
