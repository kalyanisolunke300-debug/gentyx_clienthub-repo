const { Pool } = require('pg');

async function checkPass(pass, name) {
    const host = "aws-0-ap-east-2.pooler.supabase.com";
    const user = "postgres.gcsdiilorkuvtxfwncld";
    const database = "postgres";

    console.log(`\n--- Testing ${name} ---`);
    const pool = new Pool({
        host,
        user,
        password: pass,
        database,
        port: 6543,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
    });

    try {
        const client = await pool.connect();
        console.log(`✔️ SUCCESS: Connected with ${name}`);
        client.release();
        return true;
    } catch (err) {
        console.error(`❌ FAILED: ${name}`);
        console.error(`Message: ${err.message}`);
        return false;
    } finally {
        await pool.end();
    }
}

async function run() {
    const variants = [
        { pass: "[Tushar%0099]", name: "Literal Brackets + %00" },
        { pass: "Tushar0099", name: "No Brackets, No %" },
        { pass: "[Tushar0099]", name: "Brackets, No %" },
        { pass: "Tushar%0099", name: "No Brackets, Yes %00" },
        { pass: "Tushar099", name: "No Brackets, No %, No double zero" }
    ];

    for (const v of variants) {
        if (await checkPass(v.pass, v.name)) break;
    }
}

run();
