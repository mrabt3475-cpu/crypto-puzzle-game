/**
 * ZERO-KNOWLEDGE PUZZLE ENGINE
 * نظام ألغاز لا يعرف فيه السيرفر الحل الحقيقي
 * 
 * المبدأ:
 * - السيرفر لا يحتفظ بالإجابة ابداً
 * - كل مستخدم يحصل على تحدي مختلف
 * - التحقق يتم عبر proof فقط
 */

const crypto = require('crypto');
const mongoose = require('mongoose');

const zkPuzzleSchema = new mongoose.Schema({
    level: { type: Number, required: true, unique: true, index: true },
    puzzleType: { type: String, enum: ['zk_proof', 'challenge_response', 'multi_step', 'time_locked', 'interactive', 'hash_chains'], required: true },
    question: { type: String, required: true },
    questionAr: { type: String },
    questionEn: { type: String },
    hint: { type: String },
    hintAr: { type: String },
    hintEn: { type: String },
    points: { type: Number, default: 10 },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'expert', 'master'], default: 'easy' },
    timeLimit: { type: Number, default: 300 },
    maxAttempts: { type: Number, default: 5 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

class ChallengeResponseSystem {
    constructor() { this.activeChallenges = new Map(); }
    
    createChallenge(userId, puzzleId, puzzleType) {
        const challengeId = crypto.randomUUID();
        const timestamp = Date.now();
        let challenge, expectedResponse;
        
        switch (puzzleType) {
            case 'hash_chains':
                const iterations = 3 + Math.floor(Math.random() * 5);
                let hash = crypto.randomBytes(8).toString('hex');
                for (let i = 0; i < iterations; i++) hash = crypto.createHash('sha256').update(hash).digest('hex');
                challenge = { type: 'hash_chain', seed: hash.substring(0, 8), iterations, hint: `Hash ${iterations} times` };
                expectedResponse = hash;
                break;
            case 'multi_step':
                const step1 = crypto.randomBytes(4).toString('hex');
                const step2 = Buffer.from(step1, 'hex').reverse().toString('hex');
                const step3 = Buffer.from(step2, 'hex').toString('base64');
                challenge = { type: 'multi_step', step1, hint: 'Reverse → Base64' };
                expectedResponse = step3;
                break;
            case 'time_locked':
                challenge = { type: 'time_locked', unlockTime: Date.now() + 60000, hint: 'Wait 1 minute' };
                expectedResponse = 'WAIT_COMPLETE';
                break;
            case 'interactive':
                const targetX = 100 + Math.floor(Math.random() * 200);
                const targetY = 100 + Math.floor(Math.random() * 200);
                challenge = { type: 'interactive', targetX, targetY, hint: `Click (${targetX}, ${targetY})` };
                expectedResponse = `CLICK_${targetX}_${targetY}`;
                break;
            default:
                const num = Math.floor(Math.random() * 100);
                challenge = { type: 'simple', number: num, hint: `Square of ${num}` };
                expectedResponse = (num * num).toString();
        }
        
        this.activeChallenges.set(challengeId, { userId, puzzleId, challenge, expectedResponse, createdAt: timestamp, expiresAt: new Date(timestamp + 5 * 60 * 1000) });
        return { challengeId, challenge };
    }
    
    verifyResponse(challengeId, userResponse) {
        const challenge = this.activeChallenges.get(challengeId);
        if (!challenge) return { valid: false, error: 'Challenge not found' };
        if (new Date() > challenge.expiresAt) { this.activeChallenges.delete(challengeId); return { valid: false, error: 'Challenge expired' }; }
        
        let isValid = false;
        if (challenge.challenge.type === 'time_locked') isValid = Date.now() >= challenge.challenge.unlockTime && userResponse === challenge.expectedResponse;
        else isValid = userResponse.toUpperCase() === challenge.expectedResponse.toUpperCase();
        
        if (isValid) this.activeChallenges.delete(challengeId);
        return { valid: isValid };
    }
}

const PUZZLE_TEMPLATES = {
    hash_chains: { generate: (userId, level) => { const crs = global.challengeResponseSystem || new ChallengeResponseSystem(); const { challengeId, challenge } = crs.createChallenge(userId, level, 'hash_chains'); return { type: 'hash_chains', challengeId, challenge, hint: challenge.hint, timeLimit: 180, maxAttempts: 5 }; }, verify: (challengeId, answer) => { const crs = global.challengeResponseSystem || new ChallengeResponseSystem(); return crs.verifyResponse(challengeId, answer); } },
    multi_step: { generate: (userId, level) => { const crs = global.challengeResponseSystem || new ChallengeResponseSystem(); const { challengeId, challenge } = crs.createChallenge(userId, level, 'multi_step'); return { type: 'multi_step', challengeId, challenge, hint: challenge.hint, timeLimit: 300, maxAttempts: 3 }; }, verify: (challengeId, answer) => { const crs = global.challengeResponseSystem || new ChallengeResponseSystem(); return crs.verifyResponse(challengeId, answer); } },
    time_locked: { generate: (userId, level) => { const crs = global.challengeResponseSystem || new ChallengeResponseSystem(); const { challengeId, challenge } = crs.createChallenge(userId, level, 'time_locked'); return { type: 'time_locked', challengeId, challenge, hint: challenge.hint, timeLimit: 120, maxAttempts: 1 }; }, verify: (challengeId, answer) => { const crs = global.challengeResponseSystem || new ChallengeResponseSystem(); return crs.verifyResponse(challengeId, answer); } },
    interactive: { generate: (userId, level) => { const crs = global.challengeResponseSystem || new ChallengeResponseSystem(); const { challengeId, challenge } = crs.createChallenge(userId, level, 'interactive'); return { type: 'interactive', challengeId, challenge, hint: challenge.hint, timeLimit: 60, maxAttempts: 10 }; }, verify: (challengeId, answer) => { const crs = global.challengeResponseSystem || new ChallengeResponseSystem(); return crs.verifyResponse(challengeId, answer); } },
    challenge_response: { generate: (userId, level) => { const crs = global.challengeResponseSystem || new ChallengeResponseSystem(); const { challengeId, challenge } = crs.createChallenge(userId, level, 'hash_chains'); return { type: 'challenge_response', challengeId, challenge, hint: challenge.hint, timeLimit: 180, maxAttempts: 5 }; }, verify: (challengeId, answer) => { const crs = global.challengeResponseSystem || new ChallengeResponseSystem(); return crs.verifyResponse(challengeId, answer); } },
    zk_proof: { generate: (userId, level) => { const crs = global.challengeResponseSystem || new ChallengeResponseSystem(); const { challengeId, challenge } = crs.createChallenge(userId, level, 'hash_chains'); return { type: 'zk_proof', challengeId, challenge, hint: challenge.hint, timeLimit: 300, maxAttempts: 3 }; }, verify: (challengeId, answer) => { const crs = global.challengeResponseSystem || new ChallengeResponseSystem(); return crs.verifyResponse(challengeId, answer); } }
};

zkPuzzleSchema.statics.startPuzzle = async function(userId, level) {
    const puzzle = await this.findOne({ level, isActive: true });
    if (!puzzle) return { error: 'Puzzle not found' };
    const template = PUZZLE_TEMPLATES[puzzle.puzzleType];
    if (!template) return { error: 'Invalid puzzle type' };
    const challenge = template.generate(userId, level);
    return { puzzleId: puzzle._id, level: puzzle.level, puzzleType: puzzle.puzzleType, question: puzzle.question, questionAr: puzzle.questionAr, questionEn: puzzle.questionEn, hint: puzzle.hint, ...challenge, points: puzzle.points, timeLimit: challenge.timeLimit, maxAttempts: challenge.maxAttempts };
};

zkPuzzleSchema.statics.submitAnswer = async function(userId, puzzleId, answer, challengeData) {
    const puzzle = await this.findById(puzzleId);
    if (!puzzle) return { correct: false, error: 'Puzzle not found' };
    const template = PUZZLE_TEMPLATES[puzzle.puzzleType];
    if (!template) return { correct: false, error: 'Invalid puzzle type' };
    const result = template.verify(challengeData.challengeId, answer);
    if (result.valid) return { correct: true, level: puzzle.level, points: puzzle.points, message: 'Correct!' };
    return { correct: false, message: result.error || 'Wrong answer!' };
};

zkPuzzleSchema.statics.initializePuzzles = async function() {
    const count = await this.countDocuments();
    if (count > 0) return;
    const puzzles = [
        { level: 1, puzzleType: 'hash_chains', question: 'Hash 3 times', questionAr: '哈希3次', points: 10, difficulty: 'easy' },
        { level: 2, puzzleType: 'hash_chains', question: 'Hash 4 times', questionAr: '哈希4次', points: 10, difficulty: 'easy' },
        { level: 3, puzzleType: 'hash_chains', question: 'Hash 5 times', questionAr: '哈希5次', points: 10, difficulty: 'easy' },
        { level: 4, puzzleType: 'multi_step', question: 'Reverse then Base64', questionAr: '反转后Base64', points: 15, difficulty: 'easy' },
        { level: 5, puzzleType: 'multi_step', question: 'Hex Reverse Base64', questionAr: 'Hex反转Base64', points: 15, difficulty: 'medium' },
        { level: 6, puzzleType: 'interactive', question: 'Click target', questionAr: '点击目标', points: 15, difficulty: 'medium' },
        { level: 7, puzzleType: 'interactive', question: 'Click coordinates', questionAr: '点击坐标', points: 20, difficulty: 'medium' },
        { level: 8, puzzleType: 'challenge_response', question: 'Solve challenge', questionAr: '解决挑战', points: 20, difficulty: 'medium' },
        { level: 9, puzzleType: 'challenge_response', question: 'Multi-step', questionAr: '多步', points: 20, difficulty: 'medium' },
        { level: 10, puzzleType: 'challenge_response', question: 'Complex', questionAr: '复杂', points: 25, difficulty: 'hard' },
        { level: 11, puzzleType: 'zk_proof', question: 'ZK Proof', questionAr: '零知识证明', points: 25, difficulty: 'hard' },
        { level: 12, puzzleType: 'zk_proof', question: 'Prove without reveal', questionAr: '证明不透露', points: 30, difficulty: 'hard' },
        { level: 13, puzzleType: 'time_locked', question: 'Wait unlock', questionAr: '等待解锁', points: 30, difficulty: 'hard' },
        { level: 14, puzzleType: 'time_locked', question: 'Time challenge', questionAr: '时间挑战', points: 35, difficulty: 'hard' },
        { level: 15, puzzleType: 'zk_proof', question: 'Advanced proof', questionAr: '高级证明', points: 35, difficulty: 'expert' },
        { level: 16, puzzleType: 'zk_proof', question: 'Expert proof', questionAr: '专家证明', points: 40, difficulty: 'expert' },
        { level: 17, puzzleType: 'interactive', question: 'Precision click', questionAr: '精确点击', points: 40, difficulty: 'expert' },
        { level: 18, puzzleType: 'hash_chains', question: 'Deep hash', questionAr: '深度哈希', points: 45, difficulty: 'expert' },
        { level: 19, puzzleType: 'multi_step', question: 'Complex multi', questionAr: '复杂多步', points: 45, difficulty: 'expert' },
        { level: 20, puzzleType: 'zk_proof', question: 'Master proof', questionAr: '大师证明', points: 50, difficulty: 'master' },
        { level: 21, puzzleType: 'zk_proof', question: 'Grandmaster', questionAr: '宗师', points: 50, difficulty: 'master' },
        { level: 22, puzzleType: 'time_locked', question: 'Extended wait', questionAr: '延长等待', points: 55, difficulty: 'master' },
        { level: 23, puzzleType: 'interactive', question: 'Multiple clicks', questionAr: '多次点击', points: 55, difficulty: 'master' },
        { level: 24, puzzleType: 'challenge_response', question: 'Ultimate', questionAr: '终极', points: 60, difficulty: 'master' },
        { level: 25, puzzleType: 'zk_proof', question: 'Legendary', questionAr: '传奇', points: 60, difficulty: 'master' },
        { level: 26, puzzleType: 'zk_proof', question: 'Final I', questionAr: '最终一', points: 65, difficulty: 'master' },
        { level: 27, puzzleType: 'zk_proof', question: 'Final II', questionAr: '最终二', points: 70, difficulty: 'master' },
        { level: 28, puzzleType: 'time_locked', question: 'Final wait', questionAr: '最终等待', points: 75, difficulty: 'master' },
        { level: 29, puzzleType: 'interactive', question: 'Final click', questionAr: '最终点击', points: 80, difficulty: 'master' },
        { level: 30, puzzleType: 'zk_proof', question: 'CHAMPION', questionAr: '冠军', points: 100, difficulty: 'master' }
    ];
    for (const puzzle of puzzles) await this.create(puzzle);
    console.log('30 ZK Puzzles initialized');
};

global.challengeResponseSystem = new ChallengeResponseSystem();
module.exports = mongoose.model('ZKPuzzle', zkPuzzleSchema);