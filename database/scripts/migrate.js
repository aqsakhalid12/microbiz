require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function ensureSchemaMigrationsTable(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    `);
}

async function getAppliedMigrations(client) {
    const result = await client.query('SELECT filename FROM schema_migrations ORDER BY filename');
    return new Set(result.rows.map(r => r.filename));
}

async function getMigrationFiles() {
    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();
    return files;
}

async function runMigration(client, filename) {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filePath, 'utf8');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
}

async function migrate(reset = false) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (reset) {
            if (process.env.NODE_ENV === 'production') {
                console.error('ERROR: --reset refused in production (NODE_ENV=production).');
                process.exit(1);
            }
            console.log('Resetting database: dropping and recreating public schema...');
            await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
            console.log('Public schema recreated.');
        }

        await ensureSchemaMigrationsTable(client);
        const applied = await getAppliedMigrations(client);
        const files = await getMigrationFiles();

        if (files.length === 0) {
            console.log('No migration files found.');
            await client.query('COMMIT');
            return;
        }

        for (const file of files) {
            if (applied.has(file)) {
                console.log(`Skipped (already applied): ${file}`);
            } else {
                console.log(`Applying: ${file}...`);
                try {
                    await runMigration(client, file);
                    console.log(`Applied: ${file}`);
                } catch (err) {
                    console.error(`ERROR applying ${file}: ${err.message}`);
                    await client.query('ROLLBACK');
                    process.exit(1);
                }
            }
        }

        await client.query('COMMIT');
        console.log('All migrations completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err.message);
        try { await client.query('ROLLBACK'); } catch (_) {}
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

const resetFlag = process.argv.includes('--reset');
migrate(resetFlag);