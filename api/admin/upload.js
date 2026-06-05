const XLSX = require('xlsx');
const Busboy = require('busboy');

// Admin secret check
function isAuthorized(req) {
  const secret = req.headers['x-admin-secret'];
  return secret && secret === process.env.ADMIN_SECRET;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  const busboy = Busboy({ headers: req.headers });
  const chunks = [];

  busboy.on('file', (_field, file) => {
    file.on('data', (chunk) => chunks.push(chunk));
  });

  busboy.on('finish', () => {
    try {
      const buffer = Buffer.concat(chunks);
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const parsed = rows.map((row) => {
        // Normalise column name variants (case-insensitive)
        const get = (...keys) => {
          for (const k of keys) {
            const found = Object.keys(row).find(
              (rk) => rk.trim().toLowerCase() === k.toLowerCase()
            );
            if (found !== undefined) return String(row[found]).trim();
          }
          return '';
        };

        // Date can come as JS Date object when cellDates:true
        let rawDate = get('date');
        if (row['date'] instanceof Date) {
          rawDate = row['date'].toISOString().split('T')[0];
        } else if (row['Date'] instanceof Date) {
          rawDate = row['Date'].toISOString().split('T')[0];
        }

        return {
          doc_id: get('doc_id', 'docid', 'doc id', 'document id'),
          name: get('name'),
          date: rawDate,
          role: get('role', 'designation', 'position'),
          duration: get('duration', 'internship duration', 'period'),
          remark: get('remark', 'remarks', 'note', 'notes'),
        };
      }).filter((r) => r.doc_id && r.name);

      if (parsed.length === 0) {
        return res.status(422).json({ error: 'No valid rows found. Ensure columns: doc_id, name, date, role, duration, remark' });
      }

      return res.status(200).json({ rows: parsed, total: parsed.length });
    } catch (err) {
      console.error('Upload parse error:', err);
      return res.status(500).json({ error: 'Failed to parse Excel file' });
    }
  });

  busboy.on('error', (err) => {
    console.error('Busboy error:', err);
    return res.status(500).json({ error: 'File upload error' });
  });

  req.pipe(busboy);
};
