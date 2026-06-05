const pool = require('../../lib/db');

function isAuthorized(req) {
  const secret = req.headers['x-admin-secret'];
  return secret && secret === process.env.ADMIN_SECRET;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(422).json({ error: 'No rows provided' });
  }

  // Ensure table exists with email column
  await pool.query(`
    CREATE TABLE IF NOT EXISTS offer_letters (
      id        SERIAL PRIMARY KEY,
      doc_id    VARCHAR(20) NOT NULL UNIQUE,
      name      VARCHAR(100) NOT NULL,
      email     VARCHAR(150) DEFAULT '',
      date      DATE NOT NULL,
      role      VARCHAR(100) NOT NULL,
      duration  VARCHAR(100) NOT NULL,
      remark    VARCHAR(100) NOT NULL
    )
  `);
  // Add email column if upgrading existing table
  await pool.query(`
    ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS email VARCHAR(150) DEFAULT ''
  `);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const { doc_id, name, email, date, role, duration, remark } = row;
      if (!doc_id || !name || !date) { skipped++; continue; }

      const result = await client.query(
        `INSERT INTO offer_letters (doc_id, name, email, date, role, duration, remark)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (doc_id) DO NOTHING`,
        [doc_id, name, email || '', date, role, duration, remark]
      );
      if (result.rowCount > 0) inserted++;
      else skipped++;
    }

    await client.query('COMMIT');
    return res.status(200).json({ inserted, skipped });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('DB insert error:', err);
    return res.status(500).json({ error: 'Database error while saving records' });
  } finally {
    client.release();
  }
};
