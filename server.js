require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { securityHeaders } = require('./middleware/securityAdvanced');
const puzzlesDynamic = require('./routes/puzzles_dynamic');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());
app.use(securityHeaders);
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Routes
app.use('/api/puzzle', puzzlesDynamic);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Crypto Puzzle Game API',
    version: '2.0',
    description: '30-level dynamic puzzle game with crypto challenges',
    endpoints: {
      start: 'POST /api/puzzle/start',
      question: 'GET /api/puzzle/question/:level',
      answer: 'POST /api/puzzle/answer',
      progress: 'GET /api/puzzle/progress',
      hint: 'GET /api/puzzle/hint/:level',
      health: 'GET /api/puzzle/health'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Crypto Puzzle Game API running on port ${PORT}`);
  console.log(`📚 30 dynamic puzzle levels loaded`);
  console.log(`🔐 Security middleware active`);
});

module.exports = app;
