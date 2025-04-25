const express = require('express');
const newsRoutes = require('./routes/news');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// Güvenlik önlemleri
app.use(helmet());

// CORS izinleri
app.use(cors());

// Tüm JSON cevaplarda charset=utf-8 zorunluluğu getiriyoruz
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// JSON body sınırı
app.use(express.json({ limit: '1mb' }));

// Loglama
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// API Routes
app.use('/api/v1', newsRoutes);

// 404 Hatası
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Server Başlat
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API is running securely on port ${PORT}`));
