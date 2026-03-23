const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payment');
const puzzleRoutes = require('./routes/puzzle');
const zkPuzzleRoutes = require('./routes/zkpuzzle');

const app = express();

app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", "data:", "https:"] } }, hsts: { maxAge: 31536000, includeSubDomains: true, preload: true } }));
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000', credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'x-request-signature', 'x-request-timestamp', 'x-request-nonce'], maxAge: 86400 }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: 'Too many requests' }, standardHeaders: true, legacyHeaders: false });
app.use(globalLimiter);

app.use((req, res, next) => { res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-XSS-Protection', '1; mode=block'); next(); });

app.get('/admin.php', (req, res) => { console.log('HONEYPOT:', req.ip); res.status(404).send('Not found'); });
app.get('/wp-admin', (req, res) => { console.log('HONEYPOT:', req.ip); res.status(404).send('Not found'); });
app.post('/.env', (req, res) => { console.log('HONEYPOT:', req.ip); res.status(404).send('Not found'); });

app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/puzzle', puzzleRoutes);
app.use('/api/zkpuzzle', zkPuzzleRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use((err, req, res, next) => { console.error('Error:', err); res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message }); });

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/puzzle-game';

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true, maxPoolSize: 10 }).then(async () => {
    console.log('Connected to MongoDB');
    try { const ZKPuzzle = require('./models/ZKPuzzle'); await ZKPuzzle.initializePuzzles(); } catch (err) { console.log('Puzzles initialized'); }
    app.listen(PORT, () => console.log('Server running on port', PORT));
}).catch(err => { console.error('MongoDB error:', err); process.exit(1); });

module.exports = app;