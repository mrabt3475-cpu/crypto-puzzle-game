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
const metaPuzzleRoutes = require('./routes/metapuzzle');

// Security middleware
const {
    powLimiter,
    timeVerifier,
    challengeValidator,
    advancedRateLimit,
    behavioralCheck,
    walletVerifier
} = require('./middleware/securityEnhanced');

const app = express();

// Security Layers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"]
        }
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-signature', 'x-request-timestamp', 'x-request-nonce', 'x-client-timestamp']
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Global rate limiting
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: 'Too many requests' } }));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});

// Advanced security middleware
app.use(powLimiter);           // Proof of Work
app.use(timeVerifier);         // Time verification
app.use(behavioralCheck);      // Bot detection
app.use(advancedRateLimit);    // Advanced rate limiting
app.use(walletVerifier);       // Wallet verification for advanced levels

// Honeypot
app.get('/admin.php', (req, res) => { console.log('🚨 HONEYPOT:', req.ip); res.status(404).send('Not found'); });
app.get('/wp-admin', (req, res) => { console.log('🚨 HONEYPOT:', req.ip); res.status(404).send('Not found'); });
app.post('/.env', (req, res) => { console.log('🚨 HONEYPOT:', req.ip); res.status(404).send('Not found'); });

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/puzzle', puzzleRoutes);
app.use('/api/zkpuzzle', zkPuzzleRoutes);
app.use('/api/metapuzzle', metaPuzzleRoutes);

// Health check
app.get('/health', (req, res) => res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    security: 'enhanced'
}));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message });
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/puzzle-game';

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true, maxPoolSize: 10 }).then(async () => {
    console.log('✅ MongoDB Connected');
    
    // Initialize puzzles
    try { const ZKPuzzle = require('./models/ZKPuzzle'); await ZKPuzzle.initializePuzzles(); } catch(e) {}
    try { const MetaPuzzle = require('./models/MetaPuzzle'); await MetaPuzzle.initializePuzzles(); } catch(e) {}
    
    app.listen(PORT, () => console.log('🚀 MRABT: The Lost Block - Enhanced Security - Port', PORT));
}).catch(e => { console.error(e); process.exit(1); });

module.exports = app;