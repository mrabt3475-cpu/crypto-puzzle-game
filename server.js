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
    advancedRateLimit,
    behavioralCheck,
    walletVerifier
} = require('./middleware/securityEnhanced');

const {
    ipBlockerMiddleware,
    validateInput,
    deviceFingerprintMiddleware,
    auditLogMiddleware,
    geolocationCheck,
    validateMethod
} = require('./middleware/securityMiddleware');

const {
    encryptResponse,
    decryptRequest,
    generateSecureAPIKey,
    generateUserKeyPair,
    signData,
    verifySignature
} = require('./middleware/encryptionMiddleware');

// Monitoring
const MonitoringService = require('./middleware/monitoring');
const monitoring = new MonitoringService();

global.monitoring = monitoring;

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
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-signature', 'x-request-timestamp', 'x-request-nonce', 'x-client-timestamp', 'x-api-key', 'x-signature']
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Monitoring middleware
app.use(monitoring.middleware());

// Global rate limiting
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: 'Too many requests' } }));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// Advanced security middleware
app.use(ipBlockerMiddleware);
app.use(deviceFingerprintMiddleware);
app.use(geolocationCheck);
app.use(powLimiter);
app.use(behavioralCheck);
app.use(advancedRateLimit);

// Audit logging
app.use('/api/', auditLogMiddleware('api_request'));

// Honeypot
app.get('/admin.php', (req, res) => { console.log('🚨 HONEYPOT:', req.ip); res.status(404).send('Not found'); });
app.get('/wp-admin', (req, res) => { console.log('🚨 HONEYPOT:', req.ip); res.status(404).send('Not found'); });
app.post('/.env', (req, res) => { console.log('🚨 HONEYPOT:', req.ip); res.status(404).send('Not found'); });

// API Routes
app.use('/api/auth', validateMethod('POST'), validateInput({ action: { required: true, type: 'string' } }), authRoutes);
app.use('/api/payment', validateMethod('POST', 'GET'), paymentRoutes);
app.use('/api/puzzle', validateMethod('POST', 'GET'), puzzleRoutes);
app.use('/api/zkpuzzle', validateMethod('POST', 'GET'), zkPuzzleRoutes);
app.use('/api/metapuzzle', validateMethod('POST', 'GET'), metaPuzzleRoutes);

// Encryption endpoints
app.post('/api/encryption/generate-keypair', (req, res) => {
    try {
        const keyPair = generateUserKeyPair();
        res.json({ success: true, publicKey: keyPair.publicKey });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/encryption/sign', (req, res) => {
    try {
        const { data, privateKey } = req.body;
        if (!data || !privateKey) return res.status(400).json({ error: 'Missing parameters' });
        const signature = signData(JSON.stringify(data), privateKey);
        res.json({ success: true, signature });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/encryption/verify', (req, res) => {
    try {
        const { data, signature, publicKey } = req.body;
        if (!data || !signature || !publicKey) return res.status(400).json({ error: 'Missing parameters' });
        const isValid = verifySignature(JSON.stringify(data), signature, publicKey);
        res.json({ success: true, valid: isValid });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/encryption/generate-api-key', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        const result = await generateSecureAPIKey(userId);
        res.json({ success: true, apiKey: result.apiKey });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Health & Metrics
app.get('/health', (req, res) => res.json(monitoring.getHealth()));
app.get('/metrics', (req, res) => res.json(monitoring.getMetrics()));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    monitoring.recordError(err, { path: req.path, method: req.method });
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message });
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/puzzle-game';

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true, maxPoolSize: 10 }).then(async () => {
    console.log('✅ MongoDB Connected');
    
    // Connect to Redis
    try {
        const CacheManager = require('./middleware/cache');
        const cache = new CacheManager();
        await cache.connect();
        global.cacheManager = cache;
    } catch(e) { console.log('Redis not connected, continuing without cache'); }
    
    // Initialize WebSocket
    const server = app.listen(PORT, () => {
        console.log('🚀 MRABT: The Lost Block - Production Ready - Port', PORT);
        
        // Start WebSocket
        try {
            const WebSocketHandler = require('./middleware/websocket');
            const ws = new WebSocketHandler(server);
            ws.startHeartbeat();
            global.wsHandler = ws;
        } catch(e) { console.log('WebSocket not initialized'); }
    });
    
    // Initialize puzzles
    try { const ZKPuzzle = require('./models/ZKPuzzle'); await ZKPuzzle.initializePuzzles(); } catch(e) {}
    try { const MetaPuzzle = require('./models/MetaPuzzle'); await MetaPuzzle.initializePuzzles(); } catch(e) {}
    
}).catch(e => { console.error(e); process.exit(1); });

module.exports = app;