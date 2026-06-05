const pool = require('../../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { docId } = req.query;
  if (!docId || docId.trim().length === 0) {
    return res.status(400).json({ error: 'Document ID is required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT doc_id, name, date, role, duration, remark
       FROM offer_letters
       WHERE LOWER(doc_id) = LOWER($1)
       LIMIT 1`,
      [docId.trim()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ verified: false, error: 'Offer letter not found' });
    }

    const record = rows[0];
    return res.status(200).json({
      verified: true,
      doc_id: record.doc_id,
      name: record.name,
      date: record.date,
      role: record.role,
      duration: record.duration,
      remark: record.remark,
    });
  } catch (err) {
    console.error('Verify DB error:', err);
    return res.status(500).json({ error: 'Database error' });
  }
};
