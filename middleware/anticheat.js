const crypto = require('crypto');
const { verifyAccessToken, logSuspiciousActivity } = require('./security');
const cheatDetection = new Map();

function verifyRequestIntegrity(req, secret) {
    const timestamp = req.headers['x-request-timestamp'];
    const signature = req.headers['x-request-signature'];
    if (!timestamp || !signature) return { valid: false, reason: 'Missing security headers' };
    const now = Date.now();
    if (Math.abs(now - parseInt(timestamp)) > 5 * 60 * 1000) return { valid: false, reason: 'Request expired' };
    const data = `${req.method}${req.originalUrl}${timestamp}${JSON.stringify(req.body)}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex');
    if (signature !== expectedSignature) return { valid: false, reason: 'Invalid signature' };
    return { valid: true };
}

function signRequest(req, secret) {
    const timestamp = Date.now().toString();
    const data = `${req.method}${req.originalUrl}${timestamp}${JSON.stringify(req.body)}`;
    const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
    return { timestamp, signature };
}

function analyzeUserBehavior(userId, action, data) {
    const now = Date.now();
    let detection = cheatDetection.get(userId) || { actions: new Map(), score: 0, flags: [] };
    const lastAction = detection.actions.get(action);
    if (lastAction) {
        const timeDiff = now - lastAction.timestamp;
        if (timeDiff < 2000) { detection.score += 10; detection.flags.push(`Too fast: ${timeDiff}ms`); logSuspiciousActivity(userId, 'speed_cheat', { action, timeDiff }); }
        if (lastAction.answer === data.answer) { detection.score += 5; detection.flags.push('Repeated answer'); }
    }
    detection.actions.set(action, { timestamp: now, answer: data.answer });
    if (now - (detection.lastCheck || now) > 10 * 60 * 1000) { detection.score = Math.max(0, detection.score - 20); detection.flags = []; }
    detection.lastCheck = now;
    cheatDetection.set(userId, detection);
    return { suspicious: detection.score > 50, score: detection.score, flags: detection.flags };
}

function checkIPRateLimit(ip, action, maxRequests = 10, windowMs = 60000) {
    const key = `ip:${ip}:${action}`;
    const now = Date.now();
    let requests = cheatDetection.get(key) || [];
    requests = requests.filter(t => now - t < windowMs);
    if (requests.length >= maxRequests) { logSuspiciousActivity(ip, 'rate_limit_exceeded', { count: requests.length }); return { allowed: false, reason: 'Rate limit exceeded' }; }
    requests.push(now);
    cheatDetection.set(key, requests);
    return { allowed: true };
}

async function verifyUSDTTransaction(txHash, walletAddress) {
    const axios = require('axios');
    try {
        const response = await axios.get(`https://api.trongrid.io/v1/transactions/${txHash}/info`);
        const txData = response.data?.data?.[0];
        if (!txData || !txData.confirmed) return { valid: false, reason: 'Transaction not confirmed' };
        const toAddress = txData.to_address;
        if (toAddress !== walletAddress) return { valid: false, reason: 'Wrong recipient address' };
        return { valid: true, confirmed: true };
    } catch (error) { console.error('USDT verification error:', error); return { valid: false, reason: 'Verification failed' }; }
}

function antiCheatMiddleware(req, res, next) {
    const userId = req.user?.userId;
    const ip = req.ip;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const rateCheck = checkIPRateLimit(ip, req.path);
    if (!rateCheck.allowed) return res.status(429).json({ error: rateCheck.reason });
    if (req.path.includes('/submit') || req.path.includes('/answer')) {
        const behavior = analyzeUserBehavior(userId, req.path, req.body);
        if (behavior.suspicious) { logSuspiciousActivity(userId, 'cheat_detected', { score: behavior.score, flags: behavior.flags }); return res.status(403).json({ error: 'Suspicious activity detected', flags: behavior.flags }); }
    }
    next();
}

module.exports = { verifyRequestIntegrity, signRequest, analyzeUserBehavior, checkIPRateLimit, verifyUSDTTransaction, antiCheatMiddleware };