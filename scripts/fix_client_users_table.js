const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.resolve(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
    console.error(".env.local file not found at " + envPath);
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2 && !line.trim().startsWith('#')) {
        const key = parts[0].trim();
        let value = parts.slice(1).join('=').trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
});

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('Connected to Supabase PostgreSQL.');

        // Check if client_users table exists
        const tableCheck = await client.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'client_users'
        `);

        if (tableCheck.rows.length === 0) {
            console.log('Creating client_users table...');
            await client.query(`
                CREATE TABLE IF NOT EXISTS public.client_users (
                    id SERIAL PRIMARY KEY,
                    client_id INTEGER NOT NULL,
                    user_name VARCHAR(255),
                    email VARCHAR(255),
                    role VARCHAR(50),
                    created_at TIMESTAMP DEFAULT NOW(),
                    CONSTRAINT fk_client_users_clients
                        FOREIGN KEY (client_id) REFERENCES public.clients(client_id) ON DELETE CASCADE
                )
            `);
            console.log('Table client_users created successfully.');
        } else {
            console.log('Table client_users already exists.');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
