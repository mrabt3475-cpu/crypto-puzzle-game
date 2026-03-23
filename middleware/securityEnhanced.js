/**
 * 🛡️ Enhanced Security Middleware
 * All security checks in one place
 */

const {
    ProofOfWork,
    TimeOracle,
    EncryptedChallengeSystem,
    AntiSybilSystem,
    AdvancedRateLimiter,
    BehavioralAnalyzer
} = require('./advancedSecurity');

// ============== 1. Proof of Work Middleware ==============
const powLimiter = async (req, res, next) => {
    const { powSolution, powChallenge } = req.body;
    
    // Skip for some endpoints
    const skipEndpoints = ['/health', '/api/auth/login', '/api/auth/register'];
    if (skipEndpoints.includes(req.path)) {
        return next();
    }
    
    // For high-security endpoints, require PoW
    const highSecurity = ['/api/puzzle/submit', '/api/zkpuzzle/submit', '/api/metapuzzle/submit'];
    
    if (highSecurity.includes(req.path)) {
        if (!powSolution || !powChallenge) {
            return res.status(429).json({ 
                error: 'Proof of Work required',
                challenge: ProofOfWork.generateChallenge(18)
            });
        }
        
        const isValid = ProofOfWork.verify(powSolution, powChallenge);
        if (!isValid) {
            return res.status(400).json({ error: 'Invalid Proof of Work' });
        }
    }
    
    next();
};

// ============== 2. Time Verification ==============
const timeVerifier = async (req, res, next) => {
    const clientTimestamp = req.headers['x-client-timestamp'];
    
    if (clientTimestamp) {
        const oracle = global.timeOracle || new TimeOracle();
        const isValid = oracle.verifyTimestamp(parseInt(clientTimestamp));
        
        if (!isValid) {
            console.log(`⚠️ Time manipulation detected from ${req.ip}`);
            return res.status(400).json({ error: 'Invalid timestamp' });
        }
    }
    
    next();
};

// ============== 3. Encrypted Challenge Validator ==============
const challengeValidator = async (req, res, next) => {
    const { encryptedChallenge } = req.body;
    
    if (encryptedChallenge) {
        const ecs = global.encryptedChallengeSystem || new EncryptedChallengeSystem();
        const decrypted = ecs.decrypt(encryptedChallenge);
        
        if (!decrypted) {
            return res.status(400).json({ error: 'Invalid challenge' });
        }
        
        // Check expiration
        if (decrypted.expiresAt < Date.now()) {
            return res.status(400).json({ error: 'Challenge expired' });
        }
        
        // Attach to request
        req.decryptedChallenge = decrypted;
    }
    
    next();
};

// ============== 4. Reputation Check ==============
const reputationCheck = async (req, res, next) => {
    // Skip for non-puzzle endpoints
    if (!req.path.includes('/puzzle/') && !req.path.includes('/zkpuzzle/') && !req.path.includes('/metapuzzle/')) {
        return next();
    }
    
    // In production, calculate from user data
    // For now, allow all
    next();
};

// ============== 5. Advanced Rate Limiter ==============
const advancedRateLimit = async (req, res, next) => {
    const userId = req.user?.userId || req.ip;
    const action = req.path;
    
    const limiter = global.advancedRateLimiter || new AdvancedRateLimiter();
    const result = limiter.check(userId, action, {
        maxBurst: 5,
        refillPerSecond: 0.5
    });
    
    if (!result.allowed) {
        return res.status(429).json({ 
            error: 'Rate limit exceeded',
            retryAfter: result.retryAfter
        });
    }
    
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    next();
};

// ============== 6. Behavioral Analysis ==============
const behavioralCheck = async (req, res, next) => {
    const userId = req.user?.userId;
    
    if (userId) {
        const analyzer = global.behavioralAnalyzer || new BehavioralAnalyzer();
        const analysis = analyzer.analyze(userId, req.path, {
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        
        if (analysis.isBot) {
            console.log(`⚠️ Bot detected for user ${userId}: ${analysis.reasons.join(', ')}`);
            return res.status(403).json({ 
                error: 'Suspicious activity detected',
                reasons: analysis.reasons
            });
        }
        
        req.riskScore = analysis.riskScore;
    }
    
    next();
};

// ============== 7. Wallet Verification ==============
const walletVerifier = async (req, res, next) => {
    // Skip for non-advanced levels
    const advancedLevels = ['/zkpuzzle/', '/metapuzzle/'];
    const isAdvanced = advancedLevels.some(p => req.path.includes(p));
    
    if (!isAdvanced) {
        return next();
    }
    
    // In production, verify wallet balance
    // For now, skip
    next();
};

// ============== Export All ==============
module.exports = {
    powLimiter,
    timeVerifier,
    challengeValidator,
    reputationCheck,
    advancedRateLimit,
    behavioralCheck,
    walletVerifier,
    ProofOfWork,
    TimeOracle
};
