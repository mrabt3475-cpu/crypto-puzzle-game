const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
    if (!text) return null;
    try {
        const parts = text.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = parts[1];
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) { return null; }
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return salt + ':' + hash;
}

function verifyPassword(password, storedHash) {
    const salt = storedHash.split(':')[0];
    const hash = storedHash.split(':')[1];
    const newHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === newHash;
}

function generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

const JWT_SECRET = process.env.JWT_SECRET || generateSecureToken(64);
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || generateSecureToken(64);
const JWT_EXPIRES_IN = '15m';
const JWT_REFRESH_EXPIRES_IN = '7d';

function generateAccessToken(userId, role = 'user') {
    return jwt.sign({ userId, role, type: 'access' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function generateRefreshToken(userId) {
    return jwt.sign({ userId, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

function verifyAccessToken(token) {
    try { return jwt.verify(token, JWT_SECRET); } catch (error) { return null; }
}

function verifyRefreshToken(token) {
    try { return jwt.verify(token, JWT_REFRESH_SECRET); } catch (error) { return null; }
}

function refreshAccessToken(refreshToken) {
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) return null;
    return generateAccessToken(decoded.userId);
}

const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: 'Too many requests' } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { error: 'Too many login attempts' } });
const paymentLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: { error: 'Too many payment requests' } });

const securityHeaders = helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } } });
const corsOptions = { origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'], credentials: true };

function validateInput(data, rules) {
    const errors = [];
    for (const [field, rule] of Object.entries(rules)) {
        const value = data[field];
        if (rule.required && !value) errors.push({ field, message: `${field} is required` });
        if (!value) continue;
        if (rule.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push({ field, message: 'Invalid email' });
    }
    return { valid: errors.length === 0, errors };
}

function sanitizeInput(input) {
    if (typeof input === 'string') return input.replace(/<script[^>]*>/gi, '').replace(/<\/script>/gi, '').trim();
    return input;
}

function sanitizeObject(obj) {
    if (typeof obj === 'string') return sanitizeInput(obj);
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    if (typeof obj === 'object' && obj !== null) {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) cleaned[key] = sanitizeObject(value);
        return cleaned;
    }
    return obj;
}

function logSuspiciousActivity(ip, action, details) { console.log(`🚨 [SUSPICIOUS] ${new Date().toISOString()} | IP: ${ip} | Action: ${action}`); }
function logActivity(userId, action, details) { console.log(`📝 [ACTIVITY] ${new Date().toISOString()} | User: ${userId} | Action: ${action}`); }

module.exports = { encrypt, decrypt, hashPassword, verifyPassword, generateSecureToken, generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken, refreshAccessToken, generalLimiter, authLimiter, paymentLimiter, securityHeaders, corsOptions, validateInput, sanitizeInput, sanitizeObject, logSuspiciousActivity, logActivity };