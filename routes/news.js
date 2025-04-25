// routes/news.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { decode } = require('html-entities');

const dateLimit = `AND h.Olusturulma >= DATE_SUB(NOW(), INTERVAL 1 MONTH) AND YEAR(h.Olusturulma) >= 2019`;

router.get('/headlines', async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  try {
    const [rows] = await db.query(`
      SELECT h.Id AS id, h.HaberBaslik AS title, h.Ozet AS summary, h.Resim AS image_filename,
             h.Olusturulma AS publish_date, k.Baslik AS category_name, h.Link AS web_url
      FROM haberler h
      JOIN haberkategori k ON h.KatId = k.id
      WHERE 1=1 ${dateLimit}
      ORDER BY h.Olusturulma DESC
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
      SELECT h.Id AS id, h.HaberBaslik AS title, h.Ozet AS summary, h.Resim AS image_filename,
             h.Olusturulma AS publish_date, k.Baslik AS category_name, h.Link AS web_url
      FROM haberler h
      JOIN haberkategori k ON h.KatId = k.id
      WHERE 1=1 ${dateLimit}
      ORDER BY h.Olusturulma DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    const [count] = await db.query(`SELECT COUNT(*) AS total FROM haberler h WHERE 1=1 ${dateLimit}`);
    const total = count[0].total;
    const hasMore = offset + limit < total;

    res.json({ page, limit, hasMore, articles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT id, Baslik AS name, '' AS slug FROM haberkategori`);
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
      ? await db.query(`SELECT id, Baslik AS name, '' AS slug FROM haberkategori WHERE slug = ?`, [key])
      : await db.query(`SELECT id, Baslik AS name, '' AS slug FROM haberkategori WHERE id = ?`, [key]);

    if (!category.length) return res.status(404).json({ error: 'Category not found' });

    const categoryId = category[0].id;

    const [articles] = await db.query(`
      SELECT h.Id AS id, h.HaberBaslik AS title, h.Ozet AS summary, h.Resim AS image_filename,
             h.Olusturulma AS publish_date, k.Baslik AS category_name, h.Link AS web_url
      FROM haberler h
      JOIN haberkategori k ON h.KatId = k.id
      WHERE h.KatId = ? ${dateLimit}
      ORDER BY h.Olusturulma DESC
      LIMIT ? OFFSET ?
    `, [categoryId, limit, offset]);

    const [count] = await db.query(`SELECT COUNT(*) AS total FROM haberler h WHERE KatId = ? ${dateLimit}`, [categoryId]);
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
      SELECT h.Id AS id, h.HaberBaslik AS title, h.Ozet AS summary, h.Icerik AS content,
             h.Resim AS image_filename, h.Olusturulma AS publish_date,
             k.Baslik AS category_name, h.Link AS web_url, h.Okunma AS view_count
      FROM haberler h
      JOIN haberkategori k ON h.KatId = k.id
      WHERE h.Id = ? ${dateLimit}
    `, [id]);

    if (!rows.length) return res.status(404).json({ error: 'Article not found' });

    await db.query(`UPDATE haberler SET Okunma = Okunma + 1 WHERE Id = ?`, [id]);
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
      SELECT h.Id AS id, h.HaberBaslik AS title, h.Ozet AS summary, h.Resim AS image_filename,
             h.Olusturulma AS publish_date, k.Baslik AS category_name, h.Link AS web_url
      FROM haberler h
      JOIN haberkategori k ON h.KatId = k.id
      WHERE (h.HaberBaslik LIKE ? OR h.Ozet LIKE ?) ${dateLimit}
      ORDER BY h.Olusturulma DESC
      LIMIT ? OFFSET ?
    `, [`%${query}%`, `%${query}%`, limit, offset]);

    const [count] = await db.query(`
      SELECT COUNT(*) AS total FROM haberler h
      WHERE (HaberBaslik LIKE ? OR Ozet LIKE ?) ${dateLimit}
    `, [`%${query}%`, `%${query}%`]);

    const total = count[0].total;
    const hasMore = offset + limit < total;

    res.json({ page, limit, hasMore, query, articles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
