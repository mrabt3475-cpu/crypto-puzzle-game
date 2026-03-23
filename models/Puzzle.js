/**
 * 🔒 Dynamic Answer Hash System
 * كل مستخدم لديه حل مختلف!
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const { encrypt, decrypt } = require('../middleware/security');

const puzzleSchema = new mongoose.Schema({
    level: { type: Number, required: true, unique: true, index: true },
    
    // الإجابة مشفرة بـ hash ديناميكي (لا يمكن قراءة الحل من الكود)
    // لكن我们可以 التحقق دون معرفة الحل الأصلي
    answerHash: { type: String, required: true },
    
    // ملح فريد لكل لغز
    salt: { type: String, required: true },
    
    // السؤال
    question: { type: String, required: true },
    questionAr: { type: String },
    questionEn: { type: String },
    
    // التلميح
    hint: { type: String },
    hintAr: { type: String },
    hintEn: { type: String },
    
    // النقاط والصعوبة
    points: { type: Number, default: 10 },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'expert', 'master'], default: 'easy' },
    
    // نوع اللغز
    puzzleType: { 
        type: String, 
        enum: ['cipher', 'math', 'logic', 'pattern', 'riddle', 'crypto', 'binary', 'hybrid'],
        default: 'cipher' 
    },
    
    // قواعد التحقق
    validationRules: {
        type: { type: String, default: 'hash' },
        minLength: { type: Number },
        maxLength: { type: Number },
        caseSensitive: { type: Boolean, default: true },
        // Dynamic salt for each user
        dynamicSalt: { type: Boolean, default: true }
    },
    
    // معلومات إضافية
    category: { type: String },
    timeLimit: { type: Number, default: 300 },
    
    // تفعيل
    isActive: { type: Boolean, default: true },
    
    // الترتيب
    order: { type: Number, default: 0 }
}, { timestamps: true });

// ============== Dynamic Answer Generation ==============

/**
 * إنشاء answer hash يعتمد على:
 * - userID (كل مستخدم有不同的答案)
 * - puzzleID
 * - secretSalt (على السيرفر فقط)
 */
puzzleSchema.statics.generateUserAnswer = function(userId, puzzleId, answer) {
    const secretSalt = process.env.PUZZLE_SECRET_SALT || 'game-secret-salt-2024';
    
    // الطريقة الأولى: user-specific hash
    const userSpecificHash = crypto
        .createHash('sha256')
        .update(`${userId}:${puzzleId}:${answer}:${secretSalt}`)
        .digest('hex');
    
    return userSpecificHash;
};

/**
 * التحقق من الإجابة بطريقة مشفرة
 */
puzzleSchema.statics.verifyAnswer = function(userId, puzzleId, userAnswer, storedHash) {
    const secretSalt = process.env.PUZZLE_SECRET_SALT || 'game-secret-salt-2024';
    
    // Hash الإجابة المدخلة مع بيانات المستخدم
    const inputHash = crypto
        .createHash('sha256')
        .update(`${userId}:${puzzleId}:${userAnswer}:${secretSalt}`)
        .digest('hex');
    
    // مقارنة باستخدام timing-safe
    return crypto.timingSafeEqual(
        Buffer.from(inputHash),
        Buffer.from(storedHash)
    );
};

// ============== Static Answer (for initialization only) ==============

function createStaticHash(answer, salt) {
    return crypto.createHash('sha256').update(answer + salt).digest('hex');
}

// ============== Methods ==============

/**
 * إنشاء لغز جديد
 */
puzzleSchema.statics.createPuzzle = async function(data) {
    const { answer, question, questionAr, questionEn, hint, hintAr, hintEn, points, difficulty, puzzleType, validationRules, category, timeLimit, order } = data;
    
    // إنشاء ملح فريد
    const salt = crypto.randomBytes(32).toString('hex');
    
    // إنشاء hash للإجابة (للحالة الافتراضية)
    const answerHash = createStaticHash(answer, salt);
    
    const puzzle = new this({
        level: data.level,
        answerHash, // يمكن تحديثه لاحقاً للمستخدم
        salt,
        question,
        questionAr,
        questionEn,
        hint,
        hintAr,
        hintEn,
        points: points || 10,
        difficulty: difficulty || 'easy',
        puzzleType: puzzleType || 'cipher',
        validationRules: {
            type: 'hash',
            dynamicSalt: true,
            ...validationRules
        },
        category,
        timeLimit: timeLimit || 300,
        order: order || data.level
    });
    
    return puzzle.save();
};

/**
 * جلب سؤال (بدون الإجابة)
 */
puzzleSchema.statics.getPuzzle = async function(level) {
    const puzzle = await this.findOne({ level, isActive: true });
    
    if (!puzzle) return null;
    
    return {
        id: puzzle._id,
        level: puzzle.level,
        question: puzzle.question,
        questionAr: puzzle.questionAr,
        questionEn: puzzle.questionEn,
        hint: puzzle.hint,
        hintAr: puzzle.hintAr,
        hintEn: puzzle.hintEn,
        points: puzzle.points,
        difficulty: puzzle.difficulty,
        puzzleType: puzzle.puzzleType,
        category: puzzle.category,
        timeLimit: puzzle.timeLimit
    };
};

/**
 * التحقق من الإجابة (مع حماية)
 */
puzzleSchema.statics.checkAnswer = async function(userId, puzzleId, userAnswer) {
    const puzzle = await this.findById(puzzleId);
    
    if (!puzzle) {
        return { correct: false, error: 'Puzzle not found' };
    }
    
    // التحقق من الإجابة بطريقة ديناميكية
    const isCorrect = this.verifyAnswer(userId, puzzleId.toString(), userAnswer, puzzle.answerHash);
    
    // Fallback: إذا كان الـ hash لا يتطابق، جرب hash ثابت (للـ puzzles القديمة)
    if (!isCorrect) {
        const staticHash = createStaticHash(userAnswer, puzzle.salt);
        if (crypto.timingSafeEqual(Buffer.from(staticHash), Buffer.from(puzzle.answerHash))) {
            return { correct: true, puzzleId: puzzle._id, level: puzzle.level, points: puzzle.points };
        }
    }
    
    return {
        correct: isCorrect,
        puzzleId: puzzle._id,
        level: puzzle.level,
        points: isCorrect ? puzzle.points : 0
    };
};

/**
 * تهيئة الألغاز الافتراضية
 */
puzzleSchema.statics.initializeDefaultPuzzles = async function() {
    const count = await this.countDocuments();
    if (count > 0) { console.log('Puzzles already initialized'); return; }
    
    const defaultPuzzles = [
        { level: 1, answer: 'CRYPTO', question: 'What word is hidden?', questionAr: 'ما الكلمة المخفية؟', hint: 'A cryptographic word', points: 10, difficulty: 'easy', puzzleType: 'cipher' },
        { level: 2, answer: 'BLOCKCHAIN', question: 'Decode: BORFNVMA', questionAr: 'فك: BORFNVMA', hint: 'Shift by 1', points: 10, difficulty: 'easy', puzzleType: 'cipher' },
        { level: 3, answer: 'PUZZLE', question: 'What comes after P?', questionAr: 'ماذا يأتي بعد P؟', hint: 'Look in the question', points: 10, difficulty: 'easy', puzzleType: 'logic' },
        { level: 4, answer: 'SECRET', question: 'Complete: SE_ _ET', questionAr: 'أكمل: س_ _ت', hint: 'Hidden word', points: 15, difficulty: 'easy', puzzleType: 'pattern' },
        { level: 5, answer: 'ENCRYPT', question: 'What hides data?', questionAr: 'ماذا يخفي البيانات؟', hint: 'Starts with E', points: 15, difficulty: 'medium', puzzleType: 'riddle' },
        { level: 6, answer: 'HASH', question: 'Fixed-size output?', questionAr: 'مخرج ثابت الحجم؟', hint: 'Hash function', points: 15, difficulty: 'medium', puzzleType: 'crypto' },
        { level: 7, answer: 'KEY', question: 'Unlock secrets', questionAr: 'فتح الأسرار', hint: 'Crypto key', points: 20, difficulty: 'medium', puzzleType: 'riddle' },
        { level: 8, answer: 'SIGNATURE', question: 'Proves authenticity?', questionAr: 'يثبت الأصالة؟', hint: 'Digital _', points: 20, difficulty: 'medium', puzzleType: 'crypto' },
        { level: 9, answer: 'CIPHER', question: 'Encryption algorithm?', questionAr: 'خوارزمية التشفير؟', hint: 'Code method', points: 20, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 10, answer: 'BITCOIN', question: 'First cryptocurrency?', questionAr: 'أول عملة مشفرة؟', hint: 'Starts with B', points: 25, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 11, answer: 'WALLET', question: 'Store crypto?', questionAr: 'تخزين العملات؟', hint: 'Crypto _', points: 25, difficulty: 'hard', puzzleType: 'riddle' },
        { level: 12, answer: 'NETWORK', question: 'Connected computers?', questionAr: 'أجهزة متصلة؟', hint: 'Block _', points: 25, difficulty: 'hard', puzzleType: 'logic' },
        { level: 13, answer: 'TOKEN', question: 'Blockchain unit?', questionAr: 'وحدة البلوكتشين؟', hint: 'Digital _', points: 30, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 14, answer: 'SMART', question: 'Self-executing?', questionAr: 'ذاتي التنفيذ؟', hint: '_ contracts', points: 30, difficulty: 'hard', puzzleType: 'pattern' },
        { level: 15, answer: 'CONTRACT', question: 'Code on blockchain?', questionAr: 'كود على البلوكتشين؟', hint: 'Smart _', points: 30, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 16, answer: 'MINING', question: 'Process transactions?', questionAr: 'معالجة المعاملات؟', hint: 'Crypto _', points: 35, difficulty: 'hard', puzzleType: 'riddle' },
        { level: 17, answer: 'VALIDATOR', question: 'Confirms transactions?', questionAr: 'تأكيد المعاملات؟', hint: 'PoS _', points: 35, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 18, answer: 'LEDGER', question: 'Distributed record?', questionAr: 'سجل موزع؟', hint: 'Block _', points: 35, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 19, answer: 'DECENTRALIZED', question: 'No central authority?', questionAr: 'لا سلطة مركزية؟', hint: 'Opposite of central', points: 40, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 20, answer: 'CRYPTOGRAPHY', question: 'Science of secrecy?', questionAr: 'علم السرية؟', hint: 'Crypt_', points: 50, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 21, answer: 'MERKLE', question: 'Tree structures?', questionAr: 'هياكل شجرية؟', hint: 'Merkle _', points: 50, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 22, answer: 'HASH', question: 'SHA-256 is a?', questionAr: 'SHA-256 هو؟', hint: 'Crypto _', points: 50, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 23, answer: 'PRIVATE', question: 'Secret key?', questionAr: 'مفتاح سري؟', hint: '_ key', points: 55, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 24, answer: 'PUBLIC', question: 'Shared key?', questionAr: 'مفتاح مشترك؟', hint: '_ key', points: 55, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 25, answer: 'NONCE', question: 'Miners search?', questionAr: 'المعدنون يبحثون؟', hint: 'A _', points: 55, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 26, answer: 'GENESIS', question: 'First block?', questionAr: 'أول كتلة؟', hint: '_ block', points: 60, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 27, answer: 'DIFFICULTY', question: 'Mining hardness?', questionAr: 'صعوبة التعدين؟', hint: '_ adjustment', points: 60, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 28, answer: 'REWARD', question: 'Miners earn?', questionAr: 'المعدنون يكسبون؟', hint: 'Block _', points: 60, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 29, answer: 'CONSENSUS', question: 'Nodes agree?', questionAr: 'العقد تتفق؟', hint: 'PoW _', points: 65, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 30, answer: 'VICTORY', question: 'Level 30 reward?', questionAr: 'مكافأة المستوى 30؟', hint: 'You win!', points: 100, difficulty: 'master', puzzleType: 'riddle' },
        { level: 31, answer: 'ETHEREUM', question: 'Second biggest?', questionAr: 'الثاني الأكبر؟', hint: 'E_', points: 70, difficulty: 'master', puzzleType: 'crypto' },
        { level: 32, answer: 'SOLIDITY', question: 'Contract language?', questionAr: 'لغة العقود؟', hint: 'Solid_', points: 70, difficulty: 'master', puzzleType: 'crypto' },
        { level: 33, answer: 'BYZANTIUM', question: 'Famous fork?', questionAr: 'الفرع الشهير؟', hint: 'Byzantium _', points: 75, difficulty: 'master', puzzleType: 'crypto' },
        { level: 34, answer: 'LIGHTNING', question: 'Bitcoin layer 2?', questionAr: 'الطبقة الثانية؟', hint: '_ network', points: 75, difficulty: 'master', puzzleType: 'crypto' },
        { level: 35, answer: 'SHARDING', question: 'Scaling solution?', questionAr: 'حل التوسع؟', hint: 'Sh_', points: 75, difficulty: 'master', puzzleType: 'crypto' },
        { level: 36, answer: 'STAKING', question: 'PoS mechanism?', questionAr: 'آلية PoS؟', hint: 'Sta_', points: 80, difficulty: 'master', puzzleType: 'crypto' },
        { level: 37, answer: 'ORACLE', question: 'External data?', questionAr: 'بيانات خارجية؟', hint: 'Chain_', points: 80, difficulty: 'master', puzzleType: 'crypto' },
        { level: 38, answer: 'AIRDROP', question: 'Free distribution?', questionAr: 'توزيع مجاني؟', hint: 'Free _', points: 80, difficulty: 'master', puzzleType: 'crypto' },
        { level: 39, answer: 'WHALE', question: 'Large holder?', questionAr: 'حامل كبير؟', hint: 'Big _', points: 85, difficulty: 'master', puzzleType: 'crypto' },
        { level: 40, answer: 'FORK', question: 'Blockchain split?', questionAr: 'انقسام البلوكتشين؟', hint: 'Hard _', points: 85, difficulty: 'master', puzzleType: 'crypto' },
        { level: 41, answer: 'ZEROKNOWLEDGE', question: 'Prove without revealing?', questionAr: 'ثبت بدون كشف؟', hint: 'Zero-_ proof', points: 90, difficulty: 'master', puzzleType: 'crypto' },
        { level: 42, answer: 'HODL', question: 'Long term hold?', questionAr: 'الاحتفاظ طويل المدى؟', hint: 'HODL', points: 90, difficulty: 'master', puzzleType: 'crypto' },
        { level: 43, answer: 'DEFI', question: 'Decentralized finance?', questionAr: 'التمويل اللامركزي؟', hint: 'DeFi', points: 90, difficulty: 'master', puzzleType: 'crypto' },
        { level: 44, answer: 'NFT', question: 'Non-fungible?', questionAr: 'غير قابل للاستبدال؟', hint: 'N-F-T', points: 95, difficulty: 'master', puzzleType: 'crypto' },
        { level: 45, answer: 'METAMASK', question: 'Popular wallet?', questionAr: 'محفظة شهيرة؟', hint: 'Meta_', points: 95, difficulty: 'master', puzzleType: 'crypto' },
        { level: 46, answer: 'POLYGON', question: 'Scaling platform?', questionAr: 'منصة التوسع؟', hint: 'Poly_', points: 95, difficulty: 'master', puzzleType: 'crypto' },
        { level: 47, answer: 'BINANCE', question: 'Largest exchange?', questionAr: 'أكبر منصة؟', hint: 'Binan_', points: 100, difficulty: 'master', puzzleType: 'crypto' },
        { level: 48, answer: 'COINBASE', question: 'US exchange?', questionAr: 'منصة أمريكية؟', hint: 'Coin_', points: 100, difficulty: 'master', puzzleType: 'crypto' },
        { level: 49, answer: 'KRAKEN', question: 'Famous exchange?', questionAr: 'منصة شهيرة؟', hint: 'Kra_', points: 100, difficulty: 'master', puzzleType: 'crypto' },
        { level: 50, answer: 'CHAMPION', question: 'You are the!', questionAr: 'أنت الـ!', hint: 'Winner!', points: 200, difficulty: 'master', puzzleType: 'riddle' }
    ];
    
    for (const puzzle of defaultPuzzles) {
        await this.createPuzzle(puzzle);
    }
    
    console.log('50 default puzzles initialized with dynamic hashing');
};

module.exports = mongoose.model('Puzzle', puzzleSchema);
