/**
 * 🔐 Advanced Security Middleware
 * مع حماية IP tracking و replay attack
 */

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

// Security store (use Redis in production)
const securityStore = new Map();

// ============== 1. IP & Device Fingerprinting ==============

function getClientFingerprint(req) {
    const components = [
        req.headers['user-agent'] || '',
        req.headers['accept-language'] || '',
        req.headers['accept-encoding'] || '',
        req.ip,
        req.headers['sec-ch-ua-platform'] || '',
        req.headers['sec-ch-ua-mobile'] || '',
        req.headers['x-forwarded-for'] || '',
    ].join('|');
    
    return crypto.createHash('sha256').update(components).digest('hex');
}

function getIPKey(req) {
    // Consider X-Forwarded-For for proxies
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    return `ip:${ip}`;
}

// ============== 2. Advanced Rate Limiting ==============

const strictLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute
    message: { error: 'Too many requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logSuspiciousActivity(req.user?.userId || req.ip, 'strict_rate_limit', { path: req.path });
        res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
});

const puzzleLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3, // Only 3 puzzle submissions per minute
    message: { error: 'Puzzle rate limit exceeded.' },
    handler: (req, res) => {
        logSuspiciousActivity(req.user?.userId || req.ip, 'puzzle_rate_limit', {});
        res.status(429).json({ error: 'Puzzle rate limit exceeded.' });
    }
});

// ============== 3. Progressive Delay ==============

function applyProgressiveDelay(req, res, next) {
    const ipKey = getIPKey(req);
    const delayData = securityStore.get(ipKey) || { attempts: 0, lastAttempt: 0 };
    
    // Reset after 10 minutes
    if (Date.now() - delayData.lastAttempt > 10 * 60 * 1000) {
        delayData.attempts = 0;
    }
    
    delayData.attempts++;
    delayData.lastAttempt = Date.now();
    securityStore.set(ipKey, delayData);
    
    // Progressive delay: 1s, 2s, 4s, 8s, 16s, 32s (max)
    if (delayData.attempts > 2) {
        const delay = Math.min(32000, Math.pow(2, delayData.attempts - 2) * 1000);
        console.log(`Applying ${delay}ms delay for IP: ${req.ip}`);
        setTimeout(next, delay);
    } else {
        next();
    }
}

// ============== 4. Request Signature (Anti-Replay) ==============

const REQUEST_SECRET = process.env.REQUEST_SIGNATURE_SECRET || 'super-secret-change-me';

function signRequest(req) {
    const timestamp = Date.now();
    const nonce = uuidv4();
    const payload = JSON.stringify(req.body || {});
    
    const signature = crypto
        .createHmac('sha256', REQUEST_SECRET)
        .update(`${req.method}:${req.path}:${timestamp}:${nonce}:${payload}`)
        .digest('hex');
    
    return { timestamp, nonce, signature };
}

function verifyRequestSignature(req, res, next) {
    // Skip for health and webhooks
    if (req.path === '/health' || req.path === '/api/payment/webhook' || req.path.startsWith('/api/auth/')) {
        return next();
    }
    
    const timestamp = req.headers['x-request-timestamp'];
    const nonce = req.headers['x-request-nonce'];
    const signature = req.headers['x-request-signature'];
    
    if (!timestamp || !nonce || !signature) {
        return res.status(401).json({ error: 'Missing security headers' });
    }
    
    // Check timestamp (5 minute window)
    if (Math.abs(Date.now() - parseInt(timestamp)) > 5 * 60 * 1000) {
        return res.status(401).json({ error: 'Request expired' });
    }
    
    // Check nonce (prevent replay)
    const nonceKey = `nonce:${nonce}`;
    if (securityStore.has(nonceKey)) {
        logSuspiciousActivity(req.user?.userId || req.ip, 'replay_attack', { nonce });
        return res.status(401).json({ error: 'Request already used' });
    }
    
    // Verify signature
    const payload = JSON.stringify(req.body || {});
    const expected = crypto
        .createHmac('sha256', REQUEST_SECRET)
        .update(`${req.method}:${req.path}:${timestamp}:${nonce}:${payload}`)
        .digest('hex');
    
    if (signature !== expected) {
        logSuspiciousActivity(req.user?.userId || req.ip, 'invalid_signature', { path: req.path });
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Store nonce (5 min expiry)
    securityStore.set(nonceKey, true);
    setTimeout(() => securityStore.delete(nonceKey), 5 * 60 * 1000);
    
    next();
}

// ============== 5. Behavioral Analysis ==============

function analyzeBehavior(req, res, next) {
    const ipKey = getIPKey(req);
    const fingerprint = getClientFingerprint(req);
    
    // Track request patterns
    const behaviorKey = `behavior:${ipKey}`;
    const behavior = securityStore.get(behaviorKey) || {
        requests: [],
        paths: [],
        userAgents: new Set(),
        firstSeen: Date.now(),
    };
    
    behavior.requests.push(Date.now());
    behavior.paths.push(req.path);
    if (req.headers['user-agent']) {
        behavior.userAgents.add(req.headers['user-agent']);
    }
    
    // Keep last 100 requests
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    behavior.requests = behavior.requests.filter(t => t > oneHourAgo);
    
    // Analyze patterns
    const recentRequests = behavior.requests.length;
    const uniquePaths = new Set(behavior.paths.slice(-50)).size;
    
    // Bot indicators
    if (behavior.requests.length > 200) {
        logSuspiciousActivity(req.ip, 'high_volume', { count: behavior.requests.length });
    }
    
    if (behavior.userAgents.size > 5) {
        logSuspiciousActivity(req.ip, 'user_agent_switching', { count: behavior.userAgents.size });
    }
    
    // Check for automated access (very fast requests)
    if (behavior.requests.length > 10) {
        const last10 = behavior.requests.slice(-10);
        const avgTimeBetween = (last10[9] - last10[0]) / 9;
        if (avgTimeBetween < 100) { // Less than 100ms between requests
            logSuspiciousActivity(req.ip, 'automated_access', { avgTime: avgTimeBetween });
        }
    }
    
    securityStore.set(behaviorKey, behavior);
    
    next();
}

// ============== 6. Honeypot Detection ==============

function detectHoneypot(req, res, next) {
    // Check for common bot paths
    const botPaths = ['/admin', '/wp-login', '/phpmyadmin', '/.git', '/.env', '/backup'];
    
    if (botPaths.some(p => req.path.toLowerCase().includes(p))) {
        logSuspiciousActivity(req.ip, 'honeypot_triggered', { path: req.path });
        // Don't block, just log - keep the bot thinking it found something
    }
    
    next();
}

// ============== 7. Logging & Monitoring ==============

function logActivity(userId, action, details = {}) {
    const log = {
        userId,
        action,
        details,
        timestamp: new Date().toISOString(),
    };
    console.log(JSON.stringify(log));
}

function logSuspiciousActivity(identifier, type, details = {}) {
    const log = {
        identifier,
        type,
        details,
        timestamp: new Date().toISOString(),
        severity: 'HIGH',
    };
    console.error('⚠️ SUSPICIOUS:', JSON.stringify(log));
    
    // Block severe attacks
    if (type === 'brute_force' || type === 'replay_attack') {
        const blockKey = `blocked:${identifier}`;
        securityStore.set(blockKey, true);
        setTimeout(() => securityStore.delete(blockKey), 30 * 60 * 1000); // 30 min block
    }
}

function isBlocked(req, res, next) {
    const blockKeys = [
        `blocked:${getIPKey(req)}`,
        req.user?.userId ? `blocked:${req.user.userId}` : null,
    ].filter(Boolean);
    
    if (blockKeys.some(k => securityStore.has(k))) {
        return res.status(403).json({ error: 'Temporarily blocked. Try again later.' });
    }
    
    next();
}

// ============== 8. Input Sanitization ==============

function sanitizeObject(obj) {
    if (!obj) return {};
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = value
                .replace(/<script/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+=/gi, '')
                .replace(/\$\{.*\}/g, '') // Template injection
                .replace(/<[^>]*>/g, '') // HTML tags
                .trim();
        } else if (typeof value === 'object') {
            sanitized[key] = sanitizeObject(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

// ============== Export ==============

module.exports = {
    getClientFingerprint,
    getIPKey,
    strictLimiter,
    puzzleLimiter,
    applyProgressiveDelay,
    signRequest,
    verifyRequestSignature,
    analyzeBehavior,
    detectHoneypot,
    logActivity,
    logSuspiciousActivity,
    isBlocked,
    sanitizeObject,
};
