
// routes/news.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

const dateLimit = `AND yayin_tarihi >= DATE_SUB(NOW(), INTERVAL 1 MONTH) AND YEAR(yayin_tarihi) >= 2019`;

router.get('/headlines', async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  try {
    const [rows] = await db.query(`
      SELECT h.id, h.baslik AS title, h.ozet AS summary, h.resim_dosya_adi AS image_filename,
             h.yayin_tarihi AS publish_date, k.kategori_adi AS category_name, h.web_url
      FROM haberler h
      JOIN kategoriler k ON h.kategori_id = k.id
      WHERE 1=1 ${dateLimit}
      ORDER BY h.yayin_tarihi DESC
      LIMIT ?
    `, [limit]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/latest', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  try {
    const [articles] = await db.query(`
      SELECT h.id, h.baslik AS title, h.ozet AS summary, h.resim_dosya_adi AS image_filename,
             h.yayin_tarihi AS publish_date, k.kategori_adi AS category_name, h.web_url
      FROM haberler h
      JOIN kategoriler k ON h.kategori_id = k.id
      WHERE 1=1 ${dateLimit}
      ORDER BY h.yayin_tarihi DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    const [count] = await db.query(\`SELECT COUNT(*) AS total FROM haberler WHERE 1=1 ${dateLimit}\`);
    const total = count[0].total;
    const hasMore = offset + limit < total;

    res.json({ page, limit, hasMore, articles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Diğer endpoint'ler burada varsayılabilir...
module.exports = router;
