const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payment');
const puzzleRoutes = require('./routes/puzzle');

const app = express();

// ============== SECURITY LAYERS ==============

// 1. Helmet - HTTP Security Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
}));

// 2. CORS - Strict Configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-signature', 'x-request-timestamp'],
    maxAge: 86400,
}));

// 3. Body Parser with Strict Limit
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.text({ limit: '10kb' }));
app.use(express.raw({ limit: '10kb' }));

// 4. Global Rate Limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.log(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({ error: 'Too many requests, please try again later.' });
    },
});
app.use(globalLimiter);

// 5. Request Sanitization Middleware
app.use((req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});

// ============== HONEYPOT ROUTES (Trap for Bots) ==============

// Any request to these routes = bot detected
app.get('/admin.php', (req, res) => {
    console.log(`HONEYPOT TRIGGERED: /admin.php from IP: ${req.ip}`);
    res.status(404).send('Not found');
});

app.get('/wp-admin', (req, res) => {
    console.log(`HONEYPOT TRIGGERED: /wp-admin from IP: ${req.ip}`);
    res.status(404).send('Not found');
});

app.post('/.env', (req, res) => {
    console.log(`HONEYPOT TRIGGERED: /.env from IP: ${req.ip}`);
    res.status(404).send('Not found');
});

app.post('/api/debug', (req, res) => {
    console.log(`HONEYPOT TRIGGERED: /api/debug from IP: ${req.ip}`);
    res.status(404).send('Not found');
});

// ============== API ROUTES ==============

app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/puzzle', puzzleRoutes);

// Health check (without rate limit)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============== ERROR HANDLER ==============

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    // Don't expose internal errors
    if (process.env.NODE_ENV === 'production') {
        res.status(500).json({ error: 'Internal server error' });
    } else {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// ============== DATABASE & SERVER ==============

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/puzzle-game';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
})
.then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
})
.catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

module.exports = app;
