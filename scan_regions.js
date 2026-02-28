const { Pool } = require('pg');

async function checkRegion(region) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const user = "postgres.gcsdiilorkuvtxfwncld";
    const pass = "Tushar0099"; // Trial password

    console.log(`\n--- Region: ${region} ---`);
    const pool = new Pool({ host, user, password: pass, database: "postgres", port: 6543, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 3000 });
    try {
        await pool.connect();
        console.log(`✔️ FOUND REGION: ${region}`);
        return true;
    } catch (err) {
        if (err.message.includes("Tenant or user not found")) {
            console.log(`❌ REGION WRONG: ${region}`);
        } else {
            console.log(`⚠️ REGION OK (PROBABLY), AUTH FAILED: ${region} (${err.message})`);
            return true; // We found the region, even if auth failed
        }
        return false;
    } finally {
        await pool.end();
    }
}

async function run() {
    const regions = ["ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "us-east-1", "us-east-2", "us-west-1", "us-west-2", "eu-central-1", "eu-west-1", "eu-west-2", "sa-east-1"];
    for (const r of regions) if (await checkRegion(r)) break;
}
run();
