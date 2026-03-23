/**
 * 🛡️ Complete Security Middleware
 */

const {
    InputValidator,
    DeviceFingerprinter,
    GeolocationService,
    IPBlocker,
    securityConfig
} = require('./securityComplete');

// Import audit logger
const AuditLog = require('./securityComplete').default.AuditLog;

// ============== 1. IP Blocking Middleware ==============
const ipBlockerMiddleware = async (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'];
    
    const blocker = global.ipBlocker || new IPBlocker();
    
    if (blocker.isBlocked(ip)) {
        console.log(`🚫 Blocked IP access: ${ip}`);
        return res.status(403).json({ error: 'Your IP has been temporarily blocked' });
    }
    
    next();
};

// ============== 2. Input Validation Middleware ==============
const validateInput = (schema) => {
    return async (req, res, next) => {
        const validator = global.inputValidator || new InputValidator();
        const result = validator.validateObject(req.body, schema);
        
        if (!result.valid) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: result.errors 
            });
        }
        
        next();
    };
};

// ============== 3. Device Fingerprint Middleware ==============
const deviceFingerprintMiddleware = async (req, res, next) => {
    const fingerprinter = global.deviceFingerprinter || {
        generate: (r) => {
            const crypto = require('crypto');
            return crypto.createHash('sha256').update(
                [r.headers['user-agent'], r.ip].join('|')
            ).digest('hex');
        }
    };
    
    req.deviceFingerprint = fingerprinter.generate(req);
    req.deviceInfo = fingerprinter.parseUserAgent(req.headers['user-agent'] || '');
    
    next();
};

// ============== 4. Audit Log Middleware ==============
const auditLogMiddleware = (action) => {
    return async (req, res, next) => {
        // Capture original json method
        const originalJson = res.json.bind(res);
        
        res.json = function(data) {
            // Log after response
            setImmediate(async () => {
                try {
                    const geolocation = global.geolocationService || {
                        getLocation: async () => ({ country: 'Unknown', city: 'Unknown' })
                    };
                    
                    const location = await geolocation.getLocation(req.ip);
                    
                    await AuditLog.log({
                        userId: req.user?.userId,
                        action,
                        resource: req.path,
                        ipAddress: req.ip,
                        userAgent: req.headers['user-agent'],
                        location,
                        deviceFingerprint: req.deviceFingerprint,
                        requestData: {
                            method: req.method,
                            body: req.body
                        },
                        responseStatus: res.statusCode,
                        riskScore: req.riskScore || 0
                    });
                } catch (e) {
                    console.error('Audit log error:', e);
                }
            });
            
            return originalJson(data);
        };
        
        next();
    };
};

// ============== 5. Session Validation Middleware ==============
const sessionValidator = async (req, res, next) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    // In production, validate against database
    // For now, allow
    next();
};

// ============== 6. Geolocation Check ==============
const geolocationCheck = async (req, res, next) => {
    const geolocation = global.geolocationService || {
        getLocation: async () => ({ country: 'Unknown', city: 'Unknown' })
    };
    
    req.location = await geolocation.getLocation(req.ip);
    next();
};

// ============== 7. Request Size Validation ==============
const requestSizeValidator = (maxSize = '10kb') => {
    const limits = {
        '1kb': 1024,
        '10kb': 10240,
        '100kb': 102400,
        '1mb': 1048576
    };
    
    const limit = limits[maxSize] || 10240;
    
    return async (req, res, next) => {
        const contentLength = parseInt(req.headers['content-length'] || 0);
        
        if (contentLength > limit) {
            return res.status(413).json({ 
                error: `Payload too large. Maximum size: ${maxSize}` 
            });
        }
        
        next();
    };
};

// ============== 8. Method Validation ==============
const validateMethod = (...allowedMethods) => {
    return async (req, res, next) => {
        if (!allowedMethods.includes(req.method)) {
            return res.status(405).json({ 
                error: `Method ${req.method} not allowed` 
            });
        }
        
        next();
    };
};

// ============== Export ==============
module.exports = {
    ipBlockerMiddleware,
    validateInput,
    deviceFingerprintMiddleware,
    auditLogMiddleware,
    sessionValidator,
    geolocationCheck,
    requestSizeValidator,
    validateMethod,
    InputValidator,
    securityConfig
};
