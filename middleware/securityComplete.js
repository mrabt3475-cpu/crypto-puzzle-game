/**
 * 🛡️ Complete Security Suite
 * - Audit Logging
 * - Session Management
 * - Input Validation
 * - Geolocation
 * - Device Fingerprinting
 */

const crypto = require('crypto');
const mongoose = require('mongoose');

// ============== 1. Audit Log Schema ==============
const auditLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, index: true },
    resource: { type: String },
    ipAddress: { type: String, index: true },
    userAgent: { type: String },
    location: {
        country: String,
        city: String,
        lat: Number,
        lon: Number
    },
    deviceFingerprint: { type: String, index: true },
    requestData: mongoose.Schema.Types.Mixed,
    responseStatus: Number,
    riskScore: { type: Number, default: 0 },
    metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });

class AuditLogger {
    static async log(data) {
        try {
            const log = new this(data);
            await log.save();
            
            // Alert on high risk
            if (data.riskScore > 70) {
                console.error('🚨 HIGH RISK ACTIVITY:', {
                    action: data.action,
                    userId: data.userId,
                    riskScore: data.riskScore,
                    ip: data.ipAddress
                });
            }
            
            return log;
        } catch (e) {
            console.error('Audit log error:', e);
        }
    }
    
    static async getUserActivity(userId, days = 7) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        return this.find({ userId, createdAt: { $gte: since } }).sort({ createdAt: -1 });
    }
    
    static async getSuspiciousActivity(threshold = 50) {
        return this.find({ riskScore: { $gte: threshold } })
            .sort({ createdAt: -1 })
            .limit(100);
    }
}

// ============== 2. Session Management ==============
const sessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionToken: { type: String, required: true, unique: true },
    refreshToken: { type: String, unique: true },
    deviceInfo: {
        fingerprint: String,
        browser: String,
        os: String,
        ip: String
    },
    location: {
        country: String,
        city: String
    },
    lastActivity: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

class SessionManager {
    static generateTokens() {
        const sessionToken = crypto.randomBytes(64).toString('hex');
        const refreshToken = crypto.randomBytes(64).toString('hex');
        return { sessionToken, refreshToken };
    }
    
    static async create(userId, deviceInfo, ip) {
        const { sessionToken, refreshToken } = this.generateTokens();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        
        const session = new this({
            userId,
            sessionToken,
            refreshToken,
            deviceInfo,
            ipAddress: ip,
            expiresAt
        });
        
        await session.save();
        return { sessionToken, refreshToken, expiresAt };
    }
    
    static async validate(token) {
        const session = await this.findOne({ 
            sessionToken: token, 
            isActive: true,
            expiresAt: { $gt: new Date() }
        });
        
        if (!session) return null;
        
        // Update last activity
        session.lastActivity = new Date();
        await session.save();
        
        return session;
    }
    
    static async invalidate(token) {
        return this.updateOne({ sessionToken: token }, { isActive: false });
    }
    
    static async invalidateAll(userId) {
        return this.updateMany({ userId }, { isActive: false });
    }
    
    static async cleanup() {
        // Remove expired sessions
        return this.deleteMany({ expiresAt: { $lt: new Date() } });
    }
}

// ============== 3. Input Validation ==============
class InputValidator {
    static sanitize(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/<script/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .replace(/\$\{.*\}/g, '')
            .replace(/<[^>]*>/g, '')
            .trim();
    }
    
    static validateEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }
    
    static validateUsername(username) {
        return /^[a-zA-Z0-9_]{3,20}$/.test(username);
    }
    
    static validatePassword(password) {
        return password.length >= 8 && 
               /[A-Z]/.test(password) && 
               /[a-z]/.test(password) && 
               /[0-9]/.test(password);
    }
    
    static validateAddress(address, type = 'ton') {
        if (type === 'ton') {
            return /^[A-Za-z0-9_-]{48}$/.test(address);
        }
        if (type === 'eth') {
            return /^0x[a-fA-F0-9]{40}$/.test(address);
        }
        return false;
    }
    
    static validateAmount(amount, min = 0, max = 1000000) {
        const num = parseFloat(amount);
        return !isNaN(num) && num >= min && num <= max;
    }
    
    static validateLevel(level) {
        const num = parseInt(level);
        return !isNaN(num) && num >= 1 && num <= 50;
    }
    
    static validateAnswer(answer) {
        return typeof answer === 'string' && 
               answer.length > 0 && 
               answer.length <= 1000;
    }
    
    static validateObject(obj, schema) {
        const errors = [];
        
        for (const [field, rules] of Object.entries(schema)) {
            const value = obj[field];
            
            if (rules.required && !value) {
                errors.push(`${field} is required`);
                continue;
            }
            
            if (value) {
                if (rules.type === 'email' && !this.validateEmail(value)) {
                    errors.push(`${field} must be a valid email`);
                }
                if (rules.type === 'username' && !this.validateUsername(value)) {
                    errors.push(`${field} must be 3-20 alphanumeric characters`);
                }
                if (rules.type === 'password' && !this.validatePassword(value)) {
                    errors.push(`${field} must be at least 8 characters with uppercase, lowercase, and number`);
                }
                if (rules.type === 'address' && !this.validateAddress(value, rules.walletType)) {
                    errors.push(`${field} must be a valid wallet address`);
                }
                if (rules.type === 'number') {
                    if (!this.validateAmount(value, rules.min, rules.max)) {
                        errors.push(`${field} must be between ${rules.min} and ${rules.max}`);
                    }
                }
                if (rules.type === 'level' && !this.validateLevel(value)) {
                    errors.push(`${field} must be between 1 and 50`);
                }
                if (rules.sanitize) {
                    obj[field] = this.sanitize(value);
                }
            }
        }
        
        return { valid: errors.length === 0, errors };
    }
}

// ============== 4. Geolocation ==============
class GeolocationService {
    // Simple IP to location mapping (in production, use MaxMind or similar)
    static async getLocation(ip) {
        // Skip private IPs
        if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
            return { country: 'Local', city: 'Local' };
        }
        
        // In production, use a real geolocation service
        // For now, return unknown
        return { country: 'Unknown', city: 'Unknown' };
    }
    
    static isSuspicious(location, previousLocations) {
        if (!previousLocations || previousLocations.length < 2) return false;
        
        const last = previousLocations[previousLocations.length - 1];
        
        // Different country in last hour is suspicious
        if (location.country !== last.country && location.country !== 'Unknown') {
            const timeDiff = new Date() - new Date(last.timestamp);
            if (timeDiff < 60 * 60 * 1000) { // 1 hour
                return true;
            }
        }
        
        return false;
    }
}

// ============== 5. Device Fingerprinting ==============
class DeviceFingerprinter {
    static generate(req) {
        const components = [
            req.headers['user-agent'] || '',
            req.headers['accept-language'] || '',
            req.headers['accept-encoding'] || '',
            req.headers['sec-ch-ua-platform'] || '',
            req.headers['sec-ch-ua-mobile'] || '',
            req.ip,
            req.headers['x-forwarded-for'] || ''
        ];
        
        return crypto
            .createHash('sha256')
            .update(components.join('|'))
            .digest('hex');
    }
    
    static parseUserAgent(userAgent) {
        const browser = /Chrome\/(\d+)/.test(userAgent) ? 'Chrome' :
                       /Firefox\/(\d+)/.test(userAgent) ? 'Firefox' :
                       /Safari/.test(userAgent) ? 'Safari' : 'Other';
        
        const os = /Windows/.test(userAgent) ? 'Windows' :
                  /Mac/.test(userAgent) ? 'Mac' :
                  /Linux/.test(userAgent) ? 'Linux' :
                  /Android/.test(userAgent) ? 'Android' :
                  /iOS/.test(userAgent) ? 'iOS' : 'Other';
        
        return { browser, os };
    }
}

// ============== 6. IP Blocking ==============
class IPBlocker {
    constructor() {
        this.blockedIPs = new Map(); // ip -> { reason, until }
        this.failedAttempts = new Map(); // ip -> count
    }
    
    block(ip, reason, durationMinutes = 60) {
        this.blockedIPs.set(ip, {
            reason,
            until: new Date(Date.now() + durationMinutes * 60 * 1000)
        });
    }
    
    unblock(ip) {
        this.blockedIPs.delete(ip);
    }
    
    isBlocked(ip) {
        const block = this.blockedIPs.get(ip);
        if (!block) return false;
        
        if (new Date() > block.until) {
            this.blockedIPs.delete(ip);
            return false;
        }
        
        return true;
    }
    
    recordFailedAttempt(ip) {
        const count = (this.failedAttempts.get(ip) || 0) + 1;
        this.failedAttempts.set(ip, count);
        
        if (count >= 10) { // 10 failed attempts
            this.block(ip, 'Too many failed attempts', 30);
            this.failedAttempts.delete(ip);
        }
    }
    
    clearFailedAttempts(ip) {
        this.failedAttempts.delete(ip);
    }
}

// ============== 7. Security Config ==============
const securityConfig = {
    // Authentication
    maxLoginAttempts: 5,
    lockoutDuration: 30, // minutes
    sessionDuration: 7, // days
    requireEmailVerification: true,
    requireWalletForAdvanced: true,
    
    // Rate Limiting
    rateLimit: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 100,
        maxBurst: 10
    },
    
    // Proof of Work
    powDifficulty: {
        login: 16,
        puzzle: 18,
        payment: 20
    },
    
    // Audit
    auditLogRetention: 90, // days
    alertThreshold: 70, // risk score
    
    // Geolocation
    allowMultipleCountries: false,
    suspiciousTimeWindow: 60 // minutes
};

// Initialize global instances
global.auditLogger = AuditLogger;
global.sessionManager = SessionManager;
global.inputValidator = InputValidator;
global.geolocationService = GeolocationService;
global.deviceFingerprinter = DeviceFingerprinter;
global.ipBlocker = new IPBlocker();

// Export
export {
    AuditLogger,
    SessionManager,
    InputValidator,
    GeolocationService,
    DeviceFingerprinter,
    IPBlocker,
    securityConfig
};

export default {
    AuditLogger: mongoose.model('AuditLog', auditLogSchema),
    Session: mongoose.model('Session', sessionSchema)
};
