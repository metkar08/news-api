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
             h.yayin_tarihi AS publish_date, k.adi AS category_name, h.web_url
      FROM haberler h
      JOIN haberkategori k ON h.kategori_id = k.id
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
             h.yayin_tarihi AS publish_date, k.adi AS category_name, h.web_url
      FROM haberler h
      JOIN haberkategori k ON h.kategori_id = k.id
      WHERE 1=1 ${dateLimit}
      ORDER BY h.yayin_tarihi DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    const [count] = await db.query(`SELECT COUNT(*) AS total FROM haberler WHERE 1=1 ${dateLimit}`);
    const total = count[0].total;
    const hasMore = offset + limit < total;

    res.json({ page, limit, hasMore, articles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT id, adi AS name, '' AS slug FROM haberkategori`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/category/:idOrSlug', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const offset = (page - 1) * limit;
  const key = req.params.idOrSlug;
  try {
    const [category] = isNaN(key)
      ? await db.query(`SELECT id, adi AS name, '' AS slug FROM haberkategori WHERE slug = ?`, [key])
      : await db.query(`SELECT id, adi AS name, '' AS slug FROM haberkategori WHERE id = ?`, [key]);

    if (!category.length) return res.status(404).json({ error: 'Category not found' });

    const categoryId = category[0].id;

    const [articles] = await db.query(`
      SELECT h.id, h.baslik AS title, h.ozet AS summary, h.resim_dosya_adi AS image_filename,
             h.yayin_tarihi AS publish_date, k.adi AS category_name, h.web_url
      FROM haberler h
      JOIN haberkategori k ON h.kategori_id = k.id
      WHERE h.kategori_id = ? ${dateLimit}
      ORDER BY h.yayin_tarihi DESC
      LIMIT ? OFFSET ?
    `, [categoryId, limit, offset]);

    const [count] = await db.query(`SELECT COUNT(*) AS total FROM haberler WHERE kategori_id = ? ${dateLimit}`, [categoryId]);
    const total = count[0].total;
    const hasMore = offset + limit < total;

    res.json({ page, limit, hasMore, categoryInfo: category[0], articles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/article/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [rows] = await db.query(`
      SELECT h.id, h.baslik AS title, h.ozet AS summary, h.icerik AS content,
             h.resim_dosya_adi AS image_filename, h.yayin_tarihi AS publish_date,
             k.adi AS category_name, h.web_url, h.goruntulenme_sayisi AS view_count
      FROM haberler h
      JOIN haberkategori k ON h.kategori_id = k.id
      WHERE h.id = ? ${dateLimit}
    `, [id]);

    if (!rows.length) return res.status(404).json({ error: 'Article not found' });

    await db.query(`UPDATE haberler SET goruntulenme_sayisi = goruntulenme_sayisi + 1 WHERE id = ?`, [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/search', async (req, res) => {
  const query = req.query.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  if (!query) return res.status(400).json({ error: 'Query parameter is required' });
  try {
    const [articles] = await db.query(`
      SELECT h.id, h.baslik AS title, h.ozet AS summary, h.resim_dosya_adi AS image_filename,
             h.yayin_tarihi AS publish_date, k.adi AS category_name, h.web_url
      FROM haberler h
      JOIN haberkategori k ON h.kategori_id = k.id
      WHERE (h.baslik LIKE ? OR h.ozet LIKE ?) ${dateLimit}
      ORDER BY h.yayin_tarihi DESC
      LIMIT ? OFFSET ?
    `, [`%${query}%`, `%${query}%`, limit, offset]);

    const [count] = await db.query(`
      SELECT COUNT(*) AS total FROM haberler
      WHERE (baslik LIKE ? OR ozet LIKE ?) ${dateLimit}
    `, [`%${query}%`, `%${query}%`]);

    const total = count[0].total;
    const hasMore = offset + limit < total;

    res.json({ page, limit, hasMore, query, articles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
