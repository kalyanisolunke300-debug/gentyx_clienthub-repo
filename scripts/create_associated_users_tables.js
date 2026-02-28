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

        // ===== 1. Service Center Users Table =====
        const scCheck = await client.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'service_center_users'
        `);

        if (scCheck.rows.length === 0) {
            console.log('Creating service_center_users table...');
            await client.query(`
                CREATE TABLE IF NOT EXISTS public.service_center_users (
                    id SERIAL PRIMARY KEY,
                    service_center_id INTEGER NOT NULL,
                    user_name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    role VARCHAR(100) DEFAULT 'User',
                    phone VARCHAR(50),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    CONSTRAINT fk_sc_users_service_centers
                        FOREIGN KEY (service_center_id)
                        REFERENCES public.service_centers(service_center_id)
                        ON DELETE CASCADE
                )
            `);
            console.log('✅ Table service_center_users created successfully.');
        } else {
            console.log('Table service_center_users already exists.');
        }

        // ===== 2. Update client_users table — add phone and updated_at if missing =====
        const colCheck = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'client_users'
        `);

        const existingColumns = colCheck.rows.map(r => r.column_name.toLowerCase());

        if (!existingColumns.includes('phone')) {
            console.log('Adding phone column to client_users...');
            await client.query(`ALTER TABLE public.client_users ADD COLUMN phone VARCHAR(50)`);
            console.log('✅ Added phone column to client_users.');
        }

        if (!existingColumns.includes('updated_at')) {
            console.log('Adding updated_at column to client_users...');
            await client.query(`ALTER TABLE public.client_users ADD COLUMN updated_at TIMESTAMP DEFAULT NOW()`);
            console.log('✅ Added updated_at column to client_users.');
        }

        console.log('\n✅ All migrations completed successfully!');
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
