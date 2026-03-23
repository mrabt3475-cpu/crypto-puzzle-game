/**
 * 🔐 User Model with bcrypt encryption
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        minlength: 3,
        maxlength: 30,
        trim: true,
        index: true
    },
    
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    
    // مشفر بـ bcrypt
    password: {
        type: String,
        required: true,
        minlength: 8
    },
    
    // Role النظام
    role: {
        type: String,
        enum: ['user', 'admin', 'moderator'],
        default: 'user'
    },
    
    // حالة الحساب
    isActive: {
        type: Boolean,
        default: true
    },
    
    // التحقق
    isVerified: {
        type: Boolean,
        default: false
    },
    
    // معلومات إضافية
    profile: {
        displayName: String,
        avatar: String,
        bio: String
    },
    
    // بيانات اللعب
    gameData: {
        currentLevel: { type: Number, default: 1 },
        completedLevels: [{ type: Number }],
        totalScore: { type: Number, default: 0 },
        totalTime: { type: Number, default: 0 },
        hintsUsed: { type: Number, default: 0 },
        purchasedCredits: { type: Number, default: 0 },
        keys: [{ type: String }] // مفاتيح المستخدم الفريدة
    },
    
    // الإحصائيات
    stats: {
        puzzlesSolved: { type: Number, default: 0 },
        totalAttempts: { type: Number, default: 0 },
        averageTime: { type: Number, default: 0 },
        longestStreak: { type: Number, default: 0 },
        currentStreak: { type: Number, default: 0 }
    },
    
    // الأمان
    security: {
        failedLoginAttempts: { type: Number, default: 0 },
        lockedUntil: Date,
        lastLogin: Date,
        lastIP: String,
        deviceFingerprints: [{ type: String }]
    },
    
    //Tokens
    refreshToken: String,
    
    // اللغة
    preferredLanguage: {
        type: String,
        default: 'ar'
    }
}, { timestamps: true });

// ============== Password Hashing (bcrypt) ==============

// Hash password قبل الحفظ
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        // bcrypt مع cost 12 (آمن جداً)
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// التحقق من كلمة المرور
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// ============== Account Locking ==============

// قفل الحساب بعد محاولات فاشلة
userSchema.methods.lockAccount = async function(minutes = 30) {
    this.security.failedLoginAttempts = 0;
    this.security.lockedUntil = new Date(Date.now() + minutes * 60 * 1000);
    return this.save();
};

// التحقق من حالة القفل
userSchema.methods.isLocked = function() {
    return this.security.lockedUntil && this.security.lockedUntil > new Date();
};

// ============== Security Tracking ==============

// تسجيل محاولة تسجيل دخول
userSchema.methods.recordLoginAttempt = async function(success, ip) {
    if (success) {
        this.security.failedLoginAttempts = 0;
        this.security.lastLogin = new Date();
        this.security.lastIP = ip;
    } else {
        this.security.failedLoginAttempts++;
        
        // قفل بعد 5 محاولات فاشلة
        if (this.security.failedLoginAttempts >= 5) {
            await this.lockAccount(30);
        }
    }
    
    return this.save();
};

// إضافة device fingerprint
userSchema.methods.addDeviceFingerprint = async function(fingerprint) {
    if (!this.security.deviceFingerprints.includes(fingerprint)) {
        this.security.deviceFingerprints.push(fingerprint);
        return this.save();
    }
    return this;
};

// ============== Game Progress ==============

// تحديث التقدم في اللعبة
userSchema.methods.updateGameProgress = async function(level, score, time) {
    if (!this.gameData.completedLevels.includes(level)) {
        this.gameData.completedLevels.push(level);
        this.gameData.currentLevel = Math.max(this.gameData.currentLevel, level + 1);
    }
    
    this.gameData.totalScore += score;
    this.gameData.totalTime += time;
    this.stats.puzzlesSolved++;
    
    return this.save();
};

// إضافة مفتاح
userSchema.methods.addKey = async function(key) {
    if (!this.gameData.keys.includes(key)) {
        this.gameData.keys.push(key);
        return this.save();
    }
    return this;
};

// ============== Virtual ==============

userSchema.virtual('profileUrl').get(function() {
    return `/profile/${this.username}`;
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
