// cleanup-birthdays.js
import pg from 'pg';

const client = new pg.Client({
    connectionString: process.env.DATABASE_URL // or use your connection details directly
});

async function main() {
    await client.connect();
    const res = await client.query(
        "DELETE FROM pgboss.job WHERE queue = 'birthday-notifications' AND state = 'created' AND singleton_key IS NOT NULL RETURNING id;"
    );
    console.log(`Deleted ${res.rowCount} jobs.`);
    await client.end();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});