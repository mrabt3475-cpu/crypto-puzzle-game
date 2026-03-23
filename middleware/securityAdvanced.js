/**
 * Advanced Security Middleware for Crypto Puzzle Game
 * Includes: Rate Limiting, Input Validation, Anti-Cheat, Encryption
 */

const crypto = require('crypto');
const rateLimitStore = new Map();
const attemptStore = new Map();

const CONFIG = {
  RATE_LIMIT: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    maxAttempts: 5,
    lockoutMs: 30 * 60 * 1000
  },
  INPUT: {
    maxLength: 500,
    minLength: 1,
    allowedChars: /^[a-zA-Z0-9\s\u0600-\u06FF\.\,\!\?\-\+\*\/\%\=\#\@\$\^\&\(\)\[\]]+$/
  },
  ENCRYPTION: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16
  }
};

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  return Buffer.from(key.substring(0, 64), 'hex');
}

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + CONFIG.RATE_LIMIT.windowMs });
    return next();
  }
  
  const record = rateLimitStore.get(ip);
  
  if (now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + CONFIG.RATE_LIMIT.windowMs });
    return next();
  }
  
  if (record.count >= CONFIG.RATE_LIMIT.maxRequests) {
    const remainingTime = Math.ceil((record.resetTime - now) / 1000);
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: remainingTime,
      message: `تجاوزت الحد المسموح. حاول مرة أخرى خلال ${remainingTime} ثانية`
    });
  }
  
  record.count++;
  rateLimitStore.set(ip, record);
  next();
}

function validateInput(input, fieldName = 'input') {
  const errors = [];
  
  if (input === undefined || input === null) {
    errors.push(`${fieldName} is required`);
    return { valid: false, errors };
  }
  
  if (typeof input !== 'string') {
    errors.push(`${fieldName} must be a string`);
    return { valid: false, errors };
  }
  
  const trimmed = input.trim();
  
  if (trimmed.length < CONFIG.INPUT.minLength) {
    errors.push(`${fieldName} is too short`);
  }
  
  if (trimmed.length > CONFIG.INPUT.maxLength) {
    errors.push(`${fieldName} is too long`);
  }
  
  if (!CONFIG.INPUT.allowedChars.test(trimmed)) {
    errors.push(`${fieldName} contains invalid characters`);
  }
  
  const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b|\'\;|\-\-|\/\*|\*\/)/i;
  if (sqlPatterns.test(trimmed)) {
    errors.push('Suspicious pattern detected');
  }
  
  const xssPatterns = /(<script|javascript:|onerror=|onclick=|onload=|eval\(|expression\()/i;
  if (xssPatterns.test(trimmed)) {
    errors.push('Potential XSS detected');
  }
  
  return { valid: errors.length === 0, errors, sanitized: trimmed };
}

function checkAntiCheat(userId, level, answer) {
  const key = `${userId}:${level}`;
  const now = Date.now();
  
  if (!attemptStore.has(key)) {
    attemptStore.set(key, { attempts: [], locked: false });
  }
  
  const record = attemptStore.get(key);
  
  if (record.locked) {
    if (now < record.lockedUntil) {
      return { blocked: true, remainingTime: Math.ceil((record.lockedUntil - now) / 1000) };
    } else {
      record.locked = false;
      record.attempts = [];
    }
  }
  
  record.attempts.push({ answer: hashAnswer(answer), timestamp: now });
  record.attempts = record.attempts.filter(a => now - a.timestamp < 3600000);
  
  const uniqueAnswers = new Set(record.attempts.map(a => a.answer));
  if (record.attempts.length > CONFIG.RATE_LIMIT.maxAttempts * 2) {
    record.locked = true;
    record.lockedUntil = now + CONFIG.RATE_LIMIT.lockoutMs;
    return { blocked: true, reason: 'Multiple failed attempts detected' };
  }
  
  if (uniqueAnswers.size === 1 && record.attempts.length >= CONFIG.RATE_LIMIT.maxAttempts) {
    record.locked = true;
    record.lockedUntil = now + CONFIG.RATE_LIMIT.lockoutMs;
    return { blocked: true, reason: 'Repeated same answer detected' };
  }
  
  return { blocked: false };
}

function hashAnswer(answer) {
  return crypto.createHash('sha256').update(answer + (process.env.SALT || 'default_salt')).digest('hex');
}

function encryptData(data) {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(CONFIG.ENCRYPTION.ivLength);
    const cipher = crypto.createCipheriv(CONFIG.ENCRYPTION.algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return { encrypted, iv: iv.toString('hex'), authTag: authTag.toString('hex') };
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
}

function decryptData(encryptedData) {
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    const decipher = crypto.createDecipheriv(CONFIG.ENCRYPTION.algorithm, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function generateUserHash(userId, seed) {
  return crypto.createHmac('sha256', process.env.HMAC_SECRET || 'default_secret').update(userId + seed).digest('hex');
}

function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let result = a.length === b.length ? 0 : 1;
  const minLength = Math.min(a.length, b.length);
  for (let i = 0; i < minLength; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
  if (req.protocol === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

function securityLog(event, data) {
  console.log('[SECURITY]', JSON.stringify({ timestamp: new Date().toISOString(), event, ...data }));
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetTime + CONFIG.RATE_LIMIT.windowMs) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60 * 1000);

module.exports = {
  rateLimiter,
  validateInput,
  checkAntiCheat,
  encryptData,
  decryptData,
  generateSecureToken,
  generateUserHash,
  timingSafeCompare,
  securityHeaders,
  securityLog,
  CONFIG
};