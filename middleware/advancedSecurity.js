/**
 * 🛡️ Advanced Security Layer
 * - Wallet Binding
 * - Proof of Work
 * - Time Oracle
 * - Encrypted Challenges
 */

const crypto = require('crypto');
const mongoose = require('mongoose');

// ============== 1. Wallet Binding Schema ==============
const walletBindingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    walletAddress: { type: String, required: true },
    walletType: { type: String, enum: ['ton', 'eth', 'btc'], default: 'ton' },
    verifiedAt: { type: Date, default: Date.now },
    balance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

walletBindingSchema.index({ userId: 1 }, { unique: true });

// ============== 2. Proof of Work System ==============
class ProofOfWork {
    static generateChallenge(difficulty = 20) {
        const seed = crypto.randomBytes(16).toString('hex');
        const target = '0'.repeat(Math.floor(difficulty / 4));
        
        return {
            seed,
            difficulty,
            target,
            prefix: seed.substring(0, 8)
        };
    }
    
    static verify(solution, challenge) {
        const hash = crypto.createHash('sha256')
            .update(challenge.seed + solution)
            .digest('hex');
        
        const difficulty = challenge.difficulty;
        const requiredZeros = Math.floor(difficulty / 4);
        
        return hash.startsWith('0'.repeat(requiredZeros));
    }
    
    static estimateTime(difficulty) {
        // Estimate time in seconds based on difficulty
        const hashesPerSecond = 1000000; // 1M H/s (GPU)
        const target = Math.pow(16, Math.floor(difficulty / 4));
        const totalHashes = target;
        return totalHashes / hashesPerSecond;
    }
}

// ============== 3. Time Oracle ==============
class TimeOracle {
    constructor() {
        this.approvedTimeSources = [
            'https://worldtimeapi.org/api/timezone/UTC',
            'https://timeapi.io/api/Time/current/zone?timeZone=UTC'
        ];
        this.cache = null;
        this.lastFetch = 0;
        this.cacheDuration = 60000; // 1 minute
    }
    
    async getTime() {
        // Return cached time if recent
        if (this.cache && (Date.now() - this.lastFetch) < this.cacheDuration) {
            return this.cache;
        }
        
        // In production, fetch from external API
        // For now, use server time with verification
        const serverTime = Date.now();
        
        // Add some entropy to prevent timing attacks
        const timeWithJitter = serverTime + Math.floor(Math.random() * 100);
        
        this.cache = timeWithJitter;
        this.lastFetch = Date.now();
        
        return timeWithJitter;
    }
    
    verifyTimestamp(timestamp, toleranceMs = 300000) { // 5 minutes tolerance
        const now = Date.now();
        return Math.abs(now - timestamp) < toleranceMs;
    }
}

// ============== 4. Encrypted Challenge System ==============
class EncryptedChallengeSystem {
    constructor() {
        this.encryptionKey = process.env.CHALLENGE_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    }
    
    encrypt(data) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(this.encryptionKey, 'hex'), iv);
        
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }
    
    decrypt(encryptedData) {
        try {
            const decipher = crypto.createDecipheriv(
                'aes-256-gcm',
                Buffer.from(this.encryptionKey, 'hex'),
                Buffer.from(encryptedData.iv, 'hex')
            );
            
            decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (e) {
            return null;
        }
    }
    
    generateSecureChallenge(userId, puzzleData) {
        const challenge = {
            userId,
            puzzleData,
            timestamp: Date.now(),
            nonce: crypto.randomBytes(16).toString('hex'),
            expiresAt: Date.now() + 300000 // 5 minutes
        };
        
        return this.encrypt(challenge);
    }
}

// ============== 5. Anti-Sybil System ==============
class AntiSybilSystem {
    constructor() {
        this.userReputations = new Map();
    }
    
    calculateReputation(userId, factors) {
        let score = 0;
        
        // Wallet verified (+30)
        if (factors.hasWallet) score += 30;
        
        // Telegram verified (+20)
        if (factors.telegramVerified) score += 20;
        
        // Email verified (+10)
        if (factors.emailVerified) score += 10;
        
        // Account age (+20 per month, max 60)
        const accountAgeMonths = (Date.now() - factors.accountCreated) / (30 * 24 * 60 * 60 * 1000);
        score += Math.min(60, Math.floor(accountAgeMonths * 20));
        
        // Previous puzzles solved (+2 per puzzle, max 40)
        score += Math.min(40, factors.puzzlesSolved * 2);
        
        // No previous bans (+40)
        if (!factors.hasBan) score += 40;
        
        return score;
    }
    
    isTrusted(score, requiredLevel) {
        const thresholds = {
            'easy': 30,
            'medium': 50,
            'hard': 70,
            'expert': 90,
            'master': 120,
            'legendary': 150
        };
        
        return score >= (thresholds[requiredLevel] || 50);
    }
}

// ============== 6. Rate Limiting with Burst Protection ==============
class AdvancedRateLimiter {
    constructor() {
        this.userBuckets = new Map();
    }
    
    check(userId, action, limits) {
        const key = `${userId}:${action}`;
        const bucket = this.userBuckets.get(key) || {
            tokens: limits.maxBurst || 10,
            lastRefill: Date.now(),
            requests: []
        };
        
        const now = Date.now();
        const timePassed = now - bucket.lastRefill;
        
        // Refill tokens
        const refillRate = limits.refillPerSecond || 1;
        bucket.tokens = Math.min(limits.maxBurst || 10, bucket.tokens + timePassed * refillRate / 1000);
        bucket.lastRefill = now;
        
        // Check if allowed
        if (bucket.tokens < 1) {
            return { allowed: false, retryAfter: Math.ceil(1000 / refillRate) };
        }
        
        // Consume token
        bucket.tokens -= 1;
        bucket.requests.push(now);
        
        // Keep only recent requests
        bucket.requests = bucket.requests.filter(t => t > now - 60000);
        
        // Check for burst pattern
        if (bucket.requests.length > 10) {
            return { allowed: false, reason: 'Burst detected', retryAfter: 60000 };
        }
        
        this.userBuckets.set(key, bucket);
        return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }
}

// ============== 7. Behavioral Analysis ==============
class BehavioralAnalyzer {
    constructor() {
        this.userBehaviors = new Map();
    }
    
    analyze(userId, action, data) {
        const key = userId;
        const behavior = this.userBehaviors.get(key) || {
            actions: [],
            mouseMovements: [],
            keystrokes: [],
            sessionLength: 0,
            startTime: Date.now()
        };
        
        // Record action
        behavior.actions.push({
            type: action,
            timestamp: Date.now(),
            data
        });
        
        // Keep last 100 actions
        behavior.actions = behavior.actions.slice(-100);
        
        // Analyze patterns
        const analysis = {
            isBot: false,
            riskScore: 0,
            reasons: []
        };
        
        // Check for consistent timing (bot indicator)
        if (behavior.actions.length > 5) {
            const recentActions = behavior.actions.slice(-10);
            const intervals = [];
            for (let i = 1; i < recentActions.length; i++) {
                intervals.push(recentActions[i].timestamp - recentActions[i-1].timestamp);
            }
            
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const variance = intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length;
            
            // Low variance = likely bot
            if (variance < 100) {
                analysis.isBot = true;
                analysis.riskScore += 50;
                analysis.reasons.push('Consistent timing pattern');
            }
        }
        
        // Check for too many requests
        if (behavior.actions.length > 50) {
            analysis.riskScore += 30;
            analysis.reasons.push('High request volume');
        }
        
        this.userBehaviors.set(key, behavior);
        return analysis;
    }
    
    reset(userId) {
        this.userBehaviors.delete(userId);
    }
}

// Initialize global instances
global.proofOfWork = new ProofOfWork();
global.timeOracle = new TimeOracle();
global.encryptedChallengeSystem = new EncryptedChallengeSystem();
global.antiSybilSystem = new AntiSybilSystem();
global.advancedRateLimiter = new AdvancedRateLimiter();
global.behavioralAnalyzer = new BehavioralAnalyzer();

// ============== Export ==============
module.exports = {
    ProofOfWork,
    TimeOracle,
    EncryptedChallengeSystem,
    AntiSybilSystem,
    AdvancedRateLimiter,
    BehavioralAnalyzer,
    WalletBinding: mongoose.model('WalletBinding', walletBindingSchema)
};
