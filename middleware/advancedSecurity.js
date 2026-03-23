/**
 * 🛡️ Advanced Security Middleware
 * طبقة حماية متقدمة
 */

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

// Store for security data (use Redis in production)
const securityStore = new Map();

// ============== 1. Device Fingerprinting ==============

function generateDeviceFingerprint(req) {
    const components = [
        req.headers['user-agent'],
        req.headers['accept-language'],
        req.headers['accept-encoding'],
        req.ip,
        req.headers['sec-ch-ua-platform'],
        req.headers['sec-ch-ua-mobile']
    ];
    
    const fingerprint = crypto
        .createHash('sha256')
        .update(components.join('|'))
        .digest('hex');
    
    return fingerprint;
}

// ============== 2. Advanced Rate Limiting ==============

const puzzleAttemptLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 attempts per minute
    message: { error: 'Too many attempts. Please wait.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logSuspiciousActivity(req.user?.userId || req.ip, 'rate_limit_exceeded', {
            path: req.path,
            attempts: 5
        });
        res.status(429).json({ error: 'Too many attempts. Please wait.' });
    }
});

const progressiveDelayLimiter = (req, res, next) => {
    const userId = req.user?.userId || req.ip;
    const key = `delay:${userId}`;
    
    let delayData = securityStore.get(key) || { attempts: 0, lastAttempt: 0 };
    
    // Reset after 5 minutes of no attempts
    if (Date.now() - delayData.lastAttempt > 5 * 60 * 1000) {
        delayData = { attempts: 0, lastAttempt: 0 };
    }
    
    delayData.attempts++;
    delayData.lastAttempt = Date.now();
    
    // Progressive delay: 1s, 2s, 4s, 8s, 16s...
    const delay = Math.min(30000, Math.pow(2, delayData.attempts - 1) * 1000);
    
    if (delayData.attempts > 3) {
        securityStore.set(key, delayData);
        
        // Add delay to response
        setTimeout(next, delay);
    } else {
        securityStore.set(key, delayData);
        next();
    }
};

// ============== 3. Request Signing ==============

const REQUEST_SIGNATURE_SECRET = process.env.REQUEST_SIGNATURE_SECRET || 'default-secret-change-me';

function signRequest(req) {
    const timestamp = Date.now();
    const nonce = uuidv4();
    const payload = JSON.stringify(req.body || {});
    
    const signature = crypto
        .createHmac('sha256', REQUEST_SIGNATURE_SECRET)
        .update(`${req.method}:${req.originalUrl}:${timestamp}:${nonce}:${payload}`)
        .digest('hex');
    
    return {
        timestamp,
        nonce,
        signature,
        headers: {
            'x-request-timestamp': timestamp,
            'x-request-nonce': nonce,
            'x-request-signature': signature
        }
    };
}

function verifyRequestSignature(req, res, next) {
    // Skip for some paths
    if (req.path === '/health' || req.path === '/api/payment/webhook') {
        return next();
    }
    
    const timestamp = req.headers['x-request-timestamp'];
    const nonce = req.headers['x-request-nonce'];
    const signature = req.headers['x-request-signature'];
    
    // Check timestamp (request must be within 5 minutes)
    if (!timestamp || !nonce || !signature) {
        return res.status(401).json({ error: 'Missing security headers' });
    }
    
    if (Math.abs(Date.now() - parseInt(timestamp)) > 5 * 60 * 1000) {
        return res.status(401).json({ error: 'Request expired' });
    }
    
    // Check nonce (prevent replay attacks)
    const nonceKey = `nonce:${nonce}`;
    if (securityStore.has(nonceKey)) {
        return res.status(401).json({ error: 'Request already used' });
    }
    
    // Verify signature
    const payload = JSON.stringify(req.body || {});
    const expectedSignature = crypto
        .createHmac('sha256', REQUEST_SIGNATURE_SECRET)
        .update(`${req.method}:${req.originalUrl}:${timestamp}:${nonce}:${payload}`)
        .digest('hex');
    
    if (signature !== expectedSignature) {
        logSuspiciousActivity(req.user?.userId || req.ip, 'invalid_signature', {
            path: req.path
        });
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Store nonce (expire after 5 minutes)
    securityStore.set(nonceKey, true);
    setTimeout(() => securityStore.delete(nonceKey), 5 * 60 * 1000);
    
    next();
}

// ============== 4. Anti-Bot Detection ==============

function detectBot(req) {
    const indicators = [];
    
    // Check User-Agent
    const userAgent = req.headers['user-agent'] || '';
    if (userAgent.includes('bot') || userAgent.includes('spider') || userAgent.includes('curl')) {
        indicators.push('bot_user_agent');
    }
    
    // Check for missing headers
    if (!req.headers['user-agent'] || !req.headers['accept-language']) {
        indicators.push('missing_headers');
    }
    
    // Check for automated behavior
    const ip = req.ip;
    const ipKey = `ip:${ip}`;
    let ipData = securityStore.get(ipKey) || { requests: [], firstSeen: Date.now() };
    
    ipData.requests.push(Date.now());
    
    // Keep only last 100 requests in last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    ipData.requests = ipData.requests.filter(t => t > oneHourAgo);
    
    if (ipData.requests.length > 100) {
        indicators.push('high_request_volume');
    }
    
    securityStore.set(ipKey, ipData);
    
    return {
        isBot: indicators.length > 0,
        indicators,
        riskScore: indicators.length * 25 // 0-100 risk score
    };
}

// ============== 5. IP Blocking ==============

const blockedIPs = new Set();

function blockIP(ip, duration = 3600000) {
    blockedIPs.add(ip);
    setTimeout(() => blockedIPs.delete(ip), duration);
}

function isIPBlocked(req, res, next) {
    if (blockedIPs.has(req.ip)) {
        return res.status(403).json({ error: 'IP blocked' });
    }
    next();
}

// ============== 6. Logging ==============

function logActivity(userId, action, details) {
    const log = {
        userId,
        action,
        details,
        timestamp: new Date(),
        ip: this.req?.ip
    };
    
    console.log(JSON.stringify(log));
    
    // In production, save to database or logging service
}

function logSuspiciousActivity(userId, type, details) {
    const log = {
        userId,
        type,
        details,
        timestamp: new Date(),
        severity: 'high'
    };
    
    console.error(JSON.stringify(log));
    
    // Block IP if severe
    if (type === 'brute_force' || type === 'bot_detected') {
        blockIP(details.ip || userId, 3600000); // 1 hour
    }
}

// ============== 7. Sanitization ==============

function sanitizeObject(obj) {
    if (!obj) return {};
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            // Remove potential injection patterns
            sanitized[key] = value
                .replace(/<script/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+=/gi, '')
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
    generateDeviceFingerprint,
    puzzleAttemptLimiter,
    progressiveDelayLimiter,
    signRequest,
    verifyRequestSignature,
    detectBot,
    blockIP,
    isIPBlocked,
    logActivity,
    logSuspiciousActivity,
    sanitizeObject
};
