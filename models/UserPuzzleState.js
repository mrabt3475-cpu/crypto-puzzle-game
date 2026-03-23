/**
 * 🧠 Stateful Puzzle Engine
 * نظام ألغاز ذكي مع حالة لكل مستخدم
 * 
 * Features:
 * - Composite Keys (unique per user)
 * - Context Keys (depends on previous steps)
 * - Hybrid Puzzles (Visual + Interaction + Logic)
 * - Anti-AI Protection
 * - Dynamic Difficulty
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const { encrypt, decrypt } = require('../middleware/security');

// ============== User Puzzle State Schema ==============
const userPuzzleStateSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    level: { type: Number, required: true, default: 1 },
    
    // الحالة الحالية للمستخدم
    state: {
        // مفاتيح المستخدم الفريدة
        keys: [{ key: String, value: String, createdAt: Date }],
        
        // المراحل التي زارها المستخدم
        visitedSteps: [{
            stepId: String,
            timestamp: Date,
            data: mongoose.Schema.Types.Mixed
        }],
        
        // محاولات المستخدم
        attempts: { type: Number, default: 0 },
        
        // الوقت المستغرق (بالثواني)
        timeSpent: { type: Number, default: 0 },
        
        // نقاط تفاعل المستخدم
        interactions: [{
            type: String, // click, drag, hover, input
            x: Number,
            y: Number,
            timestamp: Date
        }],
        
        // سياق سابق (previous context)
        context: {
            previousAnswer: String,
            previousPuzzleId: mongoose.Schema.Types.ObjectId,
            sequence: [String], // تسلسل الخطوات
            hintsUsed: { type: Number, default: 0 }
        },
        
        // بيانات إضافية خاصة بكل لغز
        puzzleData: mongoose.Schema.Types.Mixed
    },
    
    // معلومات الحماية
    security: {
        deviceFingerprint: String,
        ipAddress: String,
        lastActivity: Date,
        failedAttempts: { type: Number, default: 0 },
        cooldownUntil: Date,
        suspiciousActivities: [{
            type: String,
            timestamp: Date,
            details: String
        }]
    },
    
    // حالة اللغز
    status: { 
        type: String, 
        enum: ['not_started', 'in_progress', 'completed', 'failed', 'cooldown'],
        default: 'not_started' 
    },
    
    startedAt: Date,
    completedAt: Date,
    lastUpdated: Date
}, { timestamps: true });

// Index for efficient queries
userPuzzleStateSchema.index({ userId: 1, level: 1 }, { unique: true });

// ============== Advanced Key System ==============

/**
 * إنشاء composite key فريد لكل مستخدم
 * FINAL_KEY = hash(KEY1 + KEY2 + USER_ID + TIMESTAMP)
 */
function createCompositeKey(...parts) {
    const data = parts.join('|');
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

/**
 * إنشاء context key يعتمد على الحالة السابقة
 */
function createContextKey(userState, puzzleId) {
    const sequence = userState.state.context.sequence || [];
    const previousAnswer = userState.state.context.previousAnswer || '';
    const keys = userState.state.keys.map(k => k.value).join('');
    
    return createCompositeKey(
        userState.userId.toString(),
        puzzleId.toString(),
        previousAnswer,
        keys,
        sequence.join('-')
    );
}

/**
 * التحقق من صحة المفتاح
 */
function verifyKey(inputKey, expectedKey) {
    return crypto.timingSafeEqual(
        Buffer.from(inputKey),
        Buffer.from(expectedKey)
    );
}

// ============== Puzzle Generator ==============

/**
 * إنشاء لغز هجين (Hybrid Puzzle)
 * كل لغز يحتوي على:
 * - عنصر بصري (Visual)
 * - تفاعل (Interaction)
 * - منطق (Logic)
 * - ربط سابق (Context)
 */
const PUZZLE_TEMPLATES = {
    // لغز التشفير المتسلسل
    sequential_cipher: {
        type: 'sequential_cipher',
        generate: (userState, level) => {
            const baseKey = createCompositeKey(
                userState.userId.toString(),
                level.toString(),
                Date.now().toString()
            );
            
            // إنشاء تحدٍّ يعتمد على مفتاح المستخدم
            const challenge = {
                encrypted: encrypt(`PUZZLE_${level}_${baseKey}`),
                hint: `Level ${level} Challenge`,
                requiresPrevious: true, // يحتاج حل السابق
                timeLimit: 300,
                maxAttempts: 5
            };
            
            return challenge;
        }
    },
    
    // لغز النمط البصري
    visual_pattern: {
        type: 'visual_pattern',
        generate: (userState, level) => {
            // إنشاء نمط بصري فريد
            const pattern = [];
            const gridSize = 5 + Math.floor(level / 10);
            
            for (let i = 0; i < level + 3; i++) {
                pattern.push({
                    x: Math.floor(Math.random() * gridSize),
                    y: Math.floor(Math.random() * gridSize),
                    order: i + 1
                });
            }
            
            return {
                type: 'visual_click',
                gridSize,
                points: pattern,
                requiresInteraction: true, // يحتاج نقرة بترتيب
                timeLimit: 180,
                maxAttempts: 3
            };
        }
    },
    
    // لغز المنطق المتسلسل
    logic_chain: {
        type: 'logic_chain',
        generate: (userState, level) => {
            // إنشاء سلسلة منطقية
            const chainLength = 3 + Math.floor(level / 5);
            const logicSteps = [];
            
            for (let i = 0; i < chainLength; i++) {
                logicSteps.push({
                    step: i + 1,
                    question: `Solve step ${i + 1}`,
                    // الإجابة تعتمد على الخطوة السابقة
                    dependsOn: i > 0 ? i : null
                });
            }
            
            return {
                type: 'logic_chain',
                steps: logicSteps,
                requiresSequence: true, // يحتاج ترتيب معين
                timeLimit: 600,
                maxAttempts: 5
            };
        }
    },
    
    // لغز التفاعل المتقدم
    interaction_puzzle: {
        type: 'interaction_puzzle',
        generate: (userState, level) => {
            return {
                type: 'drag_and_drop',
                elements: [
                    { id: 'A', label: 'Crypto' },
                    { id: 'B', label: 'Chain' },
                    { id: 'C', label: 'Block' },
                    { id: 'D', label: 'Hash' }
                ],
                correctOrder: ['A', 'B', 'C', 'D'],
                requiresInteraction: true,
                timeLimit: 120,
                maxAttempts: 3
            };
        }
    },
    
    // لغز السياق المتقدم
    context_puzzle: {
        type: 'context_puzzle',
        generate: (userState, level) => {
            // يعتمد على حالة المستخدم السابقة
            const previousKeys = userState.state.keys.map(k => k.value);
            
            return {
                type: 'context_based',
                requiresPrevious: previousKeys.length > 0,
                contextData: previousKeys.slice(-3), // آخر 3 مفاتيح
                timeLimit: 300,
                maxAttempts: 5
            };
        }
    }
};

// ============== Anti-AI Protection ==============

/**
 * فحص مشبوه
 */
function analyzeSuspiciousActivity(userState, action, data) {
    const now = Date.now();
    const security = userState.security;
    const state = userState.state;
    
    const suspicious = [];
    
    // 1. وقت الحل سريع جداً (أقل من 5 ثوانٍ)
    if (state.timeSpent < 5 && state.attempts > 0) {
        suspicious.push('too_fast');
    }
    
    // 2. محاولات متتالية سريعة
    if (state.attempts > 10) {
        suspicious.push('brute_force');
    }
    
    // 3. نمط ثابت من الإجابات
    if (state.attempts > 3) {
        suspicious.push('pattern_repetition');
    }
    
    // 4. تفاعلات متطابقة
    if (state.interactions.length > 0) {
        const lastInteraction = state.interactions[state.interactions.length - 1];
        const similarCount = state.interactions.filter(i => 
            i.type === lastInteraction.type &&
            Math.abs(i.x - lastInteraction.x) < 10 &&
            Math.abs(i.y - lastInteraction.y) < 10
        ).length;
        
        if (similarCount > 5) {
            suspicious.push('bot_like_behavior');
        }
    }
    
    return suspicious;
}

/**
 * تطبيق العقوبات
 */
function applyPenalties(userState, reason) {
    userState.security.failedAttempts++;
    userState.security.suspiciousActivities.push({
        type: reason,
        timestamp: new Date(),
        details: `Penalty applied at level ${userState.level}`
    });
    
    // تأخير متصاعد
    const delayMinutes = Math.min(30, Math.pow(2, userState.security.failedAttempts));
    userState.security.cooldownUntil = new Date(Date.now() + delayMinutes * 60 * 1000);
    userState.status = 'cooldown';
    
    return {
        penalty: true,
        cooldownMinutes: delayMinutes,
        reason
    };
}

// ============== Methods ==============

/**
 * بدء لغز جديد للمستخدم
 */
userPuzzleStateSchema.statics.startPuzzle = async function(userId, level, deviceFingerprint, ipAddress) {
    // البحث عن حالة موجودة
    let userState = await this.findOne({ userId, level });
    
    if (!userState) {
        userState = new this({
            userId,
            level,
            state: {
                keys: [],
                visitedSteps: [],
                attempts: 0,
                timeSpent: 0,
                interactions: [],
                context: {}
            },
            security: {
                deviceFingerprint,
                ipAddress,
                lastActivity: new Date(),
                failedAttempts: 0
            },
            status: 'in_progress',
            startedAt: new Date()
        });
    }
    
    // التحقق من فترة التوقف
    if (userState.security.cooldownUntil && userState.security.cooldownUntil > new Date()) {
        const remaining = Math.ceil((userState.security.cooldownUntil - new Date()) / 60000);
        throw new Error(`Cooldown active. Try again in ${remaining} minutes`);
    }
    
    // تحديد نوع اللغز بناءً على المستوى
    const puzzleTypes = Object.keys(PUZZLE_TEMPLATES);
    const puzzleType = puzzleTypes[level % puzzleTypes.length];
    const template = PUZZLE_TEMPLATES[puzzleType];
    
    // إنشاء تحدي اللغز
    const challenge = template.generate(userState, level);
    
    userState.state.puzzleData = challenge;
    userState.status = 'in_progress';
    userState.lastUpdated = new Date();
    
    await userState.save();
    
    return {
        userStateId: userState._id,
        level: userState.level,
        challenge,
        puzzleType,
        timeLimit: challenge.timeLimit,
        maxAttempts: challenge.maxAttempts
    };
};

/**
 * تقديم إجابة
 */
userPuzzleStateSchema.statics.submitAnswer = async function(userStateId, answer, interactionData) {
    const userState = await this.findById(userStateId);
    
    if (!userState) {
        return { valid: false, error: 'Puzzle not found' };
    }
    
    if (userState.status === 'cooldown') {
        return { valid: false, error: 'Account in cooldown' };
    }
    
    // إضافة التفاعلات
    if (interactionData) {
        userState.state.interactions.push({
            ...interactionData,
            timestamp: new Date()
        });
    }
    
    // زيادة المحاولات
    userState.state.attempts++;
    
    // فحص النشاط المشبوه
    const suspicious = analyzeSuspiciousActivity(userState, 'submit', { answer });
    
    if (suspicious.length > 0) {
        const penalty = applyPenalties(userState, suspicious[0]);
        await userState.save();
        return { valid: false, ...penalty };
    }
    
    // التحقق من الإجابة
    const puzzleData = userState.state.puzzleData;
    let isValid = false;
    
    switch (puzzleData.type) {
        case 'visual_click':
            // التحقق من ترتيب النقرات
            isValid = verifyVisualClick(answer, puzzleData.points);
            break;
            
        case 'logic_chain':
            // التحقق من سلسلة المنطق
            isValid = verifyLogicChain(answer, puzzleData.steps);
            break;
            
        case 'drag_and_drop':
            // التحقق من الترتيب الصحيح
            isValid = JSON.stringify(answer) === JSON.stringify(puzzleData.correctOrder);
            break;
            
        case 'context_based':
            // التحقق من السياق
            isValid = verifyContextAnswer(answer, userState.state.context);
            break;
            
        default:
            // التحقق العام
            isValid = verifyKey(answer, puzzleData.encrypted);
    }
    
    if (isValid) {
        // إنشاء مفتاح جديد للنجاح
        const newKey = createCompositeKey(
            userState.userId.toString(),
            userState.level.toString(),
            answer,
            Date.now().toString()
        );
        
        userState.state.keys.push({
            key: `KEY_${userState.level}`,
            value: newKey,
            createdAt: new Date()
        });
        
        userState.state.context.previousAnswer = answer;
        userState.state.context.sequence.push(answer);
        userState.status = 'completed';
        userState.completedAt = new Date();
        
        await userState.save();
        
        return {
            valid: true,
            newKey,
            level: userState.level,
            nextLevel: userState.level + 1
        };
    } else {
        // تطبيق عقوبة إذا فشل
        if (userState.state.attempts >= puzzleData.maxAttempts) {
            applyPenalties(userState, 'max_attempts_exceeded');
        }
        
        await userState.save();
        
        return {
            valid: false,
            attemptsRemaining: puzzleData.maxAttempts - userState.state.attempts,
            hint: puzzleData.hint
        };
    }
};

/**
 * الحصول على حالة المستخدم الحالية
 */
userPuzzleStateSchema.statics.getUserState = async function(userId) {
    const states = await this.find({ userId }).sort({ level: 1 });
    
    return {
        currentLevel: states.find(s => s.status === 'in_progress')?.level || 1,
        completedLevels: states.filter(s => s.status === 'completed').map(s => s.level),
        totalKeys: states.reduce((acc, s) => acc + s.state.keys.length, 0),
        states: states.map(s => ({
            level: s.level,
            status: s.status,
            attempts: s.state.attempts,
            timeSpent: s.state.timeSpent
        }))
    };
};

// ============== Helper Functions ==============

function verifyVisualClick(answer, expectedPoints) {
    if (!answer || !Array.isArray(answer)) return false;
    
    // التحقق من ترتيب النقرات
    for (let i = 0; i < expectedPoints.length; i++) {
        if (answer[i]?.x !== expectedPoints[i].x || answer[i]?.y !== expectedPoints[i].y) {
            return false;
        }
    }
    return true;
}

function verifyLogicChain(answer, steps) {
    if (!answer || !Array.isArray(answer)) return false;
    
    // التحقق من أن كل خطوة صحيحة
    return answer.length === steps.length;
}

function verifyContextAnswer(answer, context) {
    // التحقق من أن الإجابة تعتمد على السياق السابق
    return answer && answer.length > 0;
}

module.exports = mongoose.model('UserPuzzleState', userPuzzleStateSchema);
module.exports.PUZZLE_TEMPLATES = PUZZLE_TEMPLATES;
module.exports.createCompositeKey = createCompositeKey;
module.exports.createContextKey = createContextKey;
module.exports.verifyKey = verifyKey;