/**
 * 🧠 Caching Layer with Redis
 * - Response caching
 * - Rate limiting
 * - Session storage
 * - Real-time pub/sub
 */

const redis = require('redis');
const crypto = require('crypto');

class CacheManager {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }
    
    async connect(url = process.env.REDIS_URL || 'redis://localhost:6379') {
        try {
            this.client = redis.createClient({
                url,
                socket: {
                    reconnectStrategy: (retries) => {
                        if (retries > 10) return new Error('Max reconnection attempts');
                        return Math.min(retries * 100, 3000);
                    }
                }
            });
            
            this.client.on('error', (err) => console.error('Redis Error:', err));
            this.client.on('connect', () => { this.isConnected = true; console.log('Redis Connected'); });
            this.client.on('disconnect', () => { this.isConnected = false; });
            
            await this.client.connect();
            return this.client;
        } catch (e) {
            console.error('Redis connection failed:', e);
            return null;
        }
    }
    
    // Cache methods
    async get(key) {
        if (!this.isConnected) return null;
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (e) { return null; }
    }
    
    async set(key, value, ttlSeconds = 300) {
        if (!this.isConnected) return;
        try {
            await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
        } catch (e) {}
    }
    
    async del(key) {
        if (!this.isConnected) return;
        try { await this.client.del(key); } catch (e) {}
    }
    
    async exists(key) {
        if (!this.isConnected) return false;
        try { return await this.client.exists(key); } catch (e) { return false; }
    }
    
    // Cache puzzle responses
    async cachePuzzle(level, data) {
        const key = `puzzle:${level}`;
        await this.set(key, data, 60); // 1 minute cache
    }
    
    async getCachedPuzzle(level) {
        const key = `puzzle:${level}`;
        return await this.get(key);
    }
    
    // Cache user progress
    async cacheUserProgress(userId, data) {
        const key = `user:${userId}:progress`;
        await this.set(key, data, 30);
    }
    
    async getCachedUserProgress(userId) {
        const key = `user:${userId}:progress`;
        return await this.get(key);
    }
    
    // Rate limiting with Redis
    async checkRateLimit(key, limit = 10, windowSeconds = 60) {
        if (!this.isConnected) return { allowed: true };
        
        const current = await this.client.incr(key);
        if (current === 1) {
            await this.client.expire(key, windowSeconds);
        }
        
        return {
            allowed: current <= limit,
            remaining: Math.max(0, limit - current),
            resetIn: windowSeconds
        };
    }
    
    // Pub/Sub for real-time
    async publish(channel, message) {
        if (!this.isConnected) return;
        await this.client.publish(channel, JSON.stringify(message));
    }
    
    async subscribe(channel, callback) {
        if (!this.isConnected) return;
        const subscriber = this.client.duplicate();
        await subscriber.connect();
        await subscriber.subscribe(channel, (message) => {
            callback(JSON.parse(message));
        });
    }
    
    // Session storage
    async storeSession(sessionId, data, ttlSeconds = 604800) { // 7 days
        const key = `session:${sessionId}`;
        await this.set(key, data, ttlSeconds);
    }
    
    async getSession(sessionId) {
        const key = `session:${sessionId}`;
        return await this.get(key);
    }
    
    async deleteSession(sessionId) {
        const key = `session:${sessionId}`;
        await this.del(key);
    }
    
    // Leaderboard
    async updateLeaderboard(userId, score) {
        if (!this.isConnected) return;
        await this.client.zAdd('leaderboard', { score, value: userId });
    }
    
    async getLeaderboard(limit = 10) {
        if (!this.isConnected) return [];
        return await this.client.zRangeWithScores('leaderboard', 0, limit - 1, { REV: true });
    }
}

// Initialize
global.cacheManager = new CacheManager();

module.exports = CacheManager;
