require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const SEED_FILE = path.join(__dirname, '..', 'seeds', '001_dev_seed.sql');

async function seed() {
    if (process.env.NODE_ENV === 'production') {
        console.error('ERROR: Seeding refused in production (NODE_ENV=production).');
        process.exit(1);
    }

    const client = await pool.connect();
    try {
        console.log('Checking for existing demo user...');
        const checkResult = await client.query(
            "SELECT id FROM users WHERE email = 'demo@microbiz.test'"
        );

        if (checkResult.rows.length > 0) {
            console.log(`Demo user already exists (id=${checkResult.rows[0].id}); skipping seed.`);
            return;
        }

        console.log('Reading seed file...');
        const sql = fs.readFileSync(SEED_FILE, 'utf8');

        console.log('Running seed...');
        await client.query(sql);
        console.log('Seed completed successfully.');
    } catch (err) {
        console.error('Seed failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();