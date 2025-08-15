// list-birthday-duplicates.js
import pg from 'pg';

const client = new pg.Client({
    connectionString: process.env.DATABASE_URL // or use your connection details directly
});

async function main() {
    await client.connect();
    // Group jobs by singleton_key and state, count duplicates
    const res = await client.query(`
        SELECT singleton_key, state, COUNT(*) as count, array_agg(id) as ids
        FROM pgboss.j8e33c0d52b86748239a271e001cae67ffea725204bf4a106b924ae21
        GROUP BY singleton_key, state
        HAVING COUNT(*) > 1
        ORDER BY singleton_key, state;
    `);
    if (res.rows.length === 0) {
        console.log('No duplicate jobs found by singleton_key and state.');
    } else {
        for (const row of res.rows) {
            console.log(row);
        }
    }
    await client.end();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
