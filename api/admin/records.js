const pool = require('../../lib/db');

function isAuthorized(req) {
  return req.headers['x-admin-secret'] === process.env.ADMIN_SECRET;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  // GET — list / search
  if (req.method === 'GET') {
    const q = (req.query.q || '').trim().toLowerCase();
    try {
      const { rows } = await pool.query(
        `SELECT id, doc_id, name, email, date, role, duration, remark
         FROM offer_letters
         ORDER BY id DESC`
      );
      const filtered = q
        ? rows.filter(
            (r) =>
              r.doc_id.toLowerCase().includes(q) ||
              r.name.toLowerCase().includes(q) ||
              (r.email || '').toLowerCase().includes(q)
          )
        : rows;
      return res.status(200).json({ rows: filtered, total: filtered.length });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch records' });
    }
  }

  // PUT — update by id
  if (req.method === 'PUT') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const { doc_id, name, email, date, role, duration, remark } = req.body;
    try {
      const { rowCount } = await pool.query(
        `UPDATE offer_letters
         SET doc_id=$1, name=$2, email=$3, date=$4, role=$5, duration=$6, remark=$7
         WHERE id=$8`,
        [doc_id, name, email || '', date, role, duration, remark, id]
      );
      if (rowCount === 0) return res.status(404).json({ error: 'Record not found' });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Update failed' });
    }
  }

  // DELETE — delete by id
  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    try {
      const { rowCount } = await pool.query('DELETE FROM offer_letters WHERE id=$1', [id]);
      if (rowCount === 0) return res.status(404).json({ error: 'Record not found' });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Delete failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
