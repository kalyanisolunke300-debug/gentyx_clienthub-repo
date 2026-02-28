const { Pool } = require('pg');

// Simulate what db.ts does
function parseDbUrl(url) {
    const parsed = new URL(url);
    return {
        host: parsed.hostname,
        port: parseInt(parsed.port, 10) || 5432,
        database: parsed.pathname.replace("/", ""),
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
    };
}

const connStr = 'postgresql://postgres.gcsdiilorkuvtxfwncld:MyNewPass2026@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
const dbConfig = parseDbUrl(connStr);

const pool = new Pool({
    ...dbConfig,
    ssl: { rejectUnauthorized: false },
    max: 10,
    connectionTimeoutMillis: 10000,
});

async function testLogin() {
    try {
        // Simulate exact login query
        const result = await pool.query(`
      SELECT id, email, password, role
      FROM public."Users"
      WHERE email = $1
      LIMIT 1
    `, ['Saurabh@gmail.com']);

        console.log('Login query result:', JSON.stringify(result.rows, null, 2));

        if (result.rows.length > 0) {
            const user = result.rows[0];
            console.log('\nPassword check:');
            console.log('  DB password:', user.password);
            console.log('  Input password: Saurabh#43');
            console.log('  Match:', user.password === 'Saurabh#43');
        }
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await pool.end();
    }
}

testLogin();
