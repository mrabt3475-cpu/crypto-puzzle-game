const mongoose = require('mongoose');
const crypto = require('crypto');
const { encrypt } = require('../middleware/security');

const puzzleSchema = new mongoose.Schema({
    level: { type: Number, required: true, unique: true, index: true },
    encryptedAnswer: { type: String, required: true },
    answerSalt: { type: String, required: true },
    answerHash: { type: String, required: true },
    question: { type: String, required: true },
    questionAr: { type: String },
    questionEn: { type: String },
    hint: { type: String },
    hintAr: { type: String },
    hintEn: { type: String },
    points: { type: Number, default: 10 },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'expert', 'master'], default: 'easy' },
    puzzleType: { type: String, enum: ['cipher', 'math', 'logic', 'pattern', 'riddle', 'crypto', 'binary', 'steganography'], default: 'cipher' },
    validationRules: { type: { type: String, default: 'exact' }, pattern: { type: String }, minLength: { type: Number }, maxLength: { type: Number }, caseSensitive: { type: Boolean, default: true } },
    category: { type: String },
    timeLimit: { type: Number, default: 300 },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
}, { timestamps: true });

function createSecureAnswer(plainAnswer) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(plainAnswer + salt).digest('hex');
    const encrypted = encrypt(plainAnswer);
    return { encryptedAnswer: encrypted, answerSalt: salt, answerHash: hash };
}

function verifyAnswer(plainAnswer, storedHash, salt) {
    const hash = crypto.createHash('sha256').update(plainAnswer + salt).digest('hex');
    return hash === storedHash;
}

puzzleSchema.statics.createPuzzle = async function(data) {
    const { answer, question, questionAr, questionEn, hint, hintAr, hintEn, points, difficulty, puzzleType, validationRules, category, timeLimit, order } = data;
    const secureAnswer = createSecureAnswer(answer);
    const puzzle = new this({ level: data.level, ...secureAnswer, question, questionAr, questionEn, hint, hintAr, hintEn, points: points || 10, difficulty: difficulty || 'easy', puzzleType: puzzleType || 'cipher', validationRules: validationRules || { type: 'exact', caseSensitive: true }, category, timeLimit: timeLimit || 300, order: order || data.level });
    return puzzle.save();
};

puzzleSchema.statics.getRandomPuzzle = async function(userId, currentLevel) {
    const puzzle = await this.findOne({ level: { $gte: currentLevel }, isActive: true }).sort({ level: 1 });
    if (!puzzle) return null;
    return { id: puzzle._id, level: puzzle.level, question: puzzle.question, questionAr: puzzle.questionAr, questionEn: puzzle.questionEn, hint: puzzle.hint, hintAr: puzzle.hintAr, hintEn: puzzle.hintEn, points: puzzle.points, difficulty: puzzle.difficulty, puzzleType: puzzle.puzzleType, category: puzzle.category, timeLimit: puzzle.timeLimit };
};

puzzleSchema.statics.checkAnswer = async function(puzzleId, userAnswer) {
    const puzzle = await this.findById(puzzleId);
    if (!puzzle) return { correct: false, error: 'Puzzle not found' };
    const isCorrect = verifyAnswer(userAnswer, puzzle.answerHash, puzzle.answerSalt);
    return { correct: isCorrect, puzzleId: puzzle._id, level: puzzle.level, points: isCorrect ? puzzle.points : 0 };
};

puzzleSchema.statics.initializeDefaultPuzzles = async function() {
    const count = await this.countDocuments();
    if (count > 0) { console.log('Puzzles already initialized'); return; }
    const defaultPuzzles = [
        // Levels 1-20 (Easy to Hard)
        { level: 1, answer: 'CRYPTO', question: 'What word is hidden?', questionAr: 'ما الكلمة المخفية؟', hint: 'A cryptographic word', points: 10, difficulty: 'easy', puzzleType: 'cipher' },
        { level: 2, answer: 'BLOCKCHAIN', question: 'Decode this: BORFNVMA', questionAr: 'فك التشفير: BORFNVMA', hint: 'Shift by 1', points: 10, difficulty: 'easy', puzzleType: 'cipher' },
        { level: 3, answer: 'PUZZLE', question: 'What comes after P?', questionAr: 'ماذا يأتي بعد P؟', hint: 'The answer is in the question', points: 10, difficulty: 'easy', puzzleType: 'logic' },
        { level: 4, answer: 'SECRET', question: 'Complete: SE_ _ET', questionAr: 'أكمل: س_ _ت', hint: 'A hidden word', points: 15, difficulty: 'easy', puzzleType: 'pattern' },
        { level: 5, answer: 'ENCRYPT', question: 'What do you do to hide data?', questionAr: 'ماذا تفعل لإخفاء البيانات؟', hint: 'Starts with E', points: 15, difficulty: 'medium', puzzleType: 'riddle' },
        { level: 6, answer: 'HASH', question: 'What creates a fixed-size output?', questionAr: 'ماذا ينتج حجم ثابت؟', hint: 'A hash function', points: 15, difficulty: 'medium', puzzleType: 'crypto' },
        { level: 7, answer: 'KEY', question: 'You need this to unlock secrets', questionAr: 'تحتاج هذا لفتح الأسرار', hint: 'A cryptographic key', points: 20, difficulty: 'medium', puzzleType: 'riddle' },
        { level: 8, answer: 'SIGNATURE', question: 'What proves authenticity?', questionAr: 'ماذا يثبت الأصالة؟', hint: 'Digital signature', points: 20, difficulty: 'medium', puzzleType: 'crypto' },
        { level: 9, answer: 'CIPHER', question: 'What is the algorithm called?', questionAr: 'ماذا يُسمى الخوارزمية؟', hint: 'Encryption cipher', points: 20, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 10, answer: 'BITCOIN', question: 'The first cryptocurrency', questionAr: 'أول عملة مشفرة', hint: 'Starts with B', points: 25, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 11, answer: 'WALLET', question: 'Where do you store crypto?', questionAr: 'أين تخزن العملات؟', hint: 'Crypto wallet', points: 25, difficulty: 'hard', puzzleType: 'riddle' },
        { level: 12, answer: 'NETWORK', question: 'A system of connected computers', questionAr: 'نظام أجهزة متصلة', hint: 'Blockchain network', points: 25, difficulty: 'hard', puzzleType: 'logic' },
        { level: 13, answer: 'TOKEN', question: 'A unit of value on blockchain', questionAr: 'وحدة قيمة على البلوكتشين', hint: 'Digital token', points: 30, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 14, answer: 'SMART', question: 'What contracts are they?', questionAr: 'ما نوع العقود؟', hint: 'Smart _', points: 30, difficulty: 'hard', puzzleType: 'pattern' },
        { level: 15, answer: 'CONTRACT', question: 'Self-executing code on blockchain', questionAr: 'كود ذاتي التنفيذ', hint: 'Smart _', points: 30, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 16, answer: 'MINING', question: 'What do miners do?', questionAr: 'ماذا يفعل المعدنون؟', hint: 'Process transactions', points: 35, difficulty: 'hard', puzzleType: 'riddle' },
        { level: 17, answer: 'VALIDATOR', question: 'Who confirms transactions?', questionAr: 'من يؤكد المعاملات؟', hint: 'Proof of Stake', points: 35, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 18, answer: 'LEDGER', question: 'A distributed record', questionAr: 'سجل موزع', hint: 'Blockchain _', points: 35, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 19, answer: 'DECENTRALIZED', question: 'No central authority', questionAr: 'لا سلطة مركزية', hint: 'Opposite of centralized', points: 40, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 20, answer: 'CRYPTOGRAPHY', question: 'The science of secrecy', questionAr: 'علم السرية', hint: 'Crypt_', points: 50, difficulty: 'hard', puzzleType: 'crypto' },
        // Levels 21-30 (Expert)
        { level: 21, answer: 'MERKLE', question: 'What tree structures blockchain data?', questionAr: 'ماذا يُنشئ هيكل شجرة في البلوكتشين؟', hint: 'Merkle _', points: 50, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 22, answer: 'HASH', question: 'What is SHA-256?', questionAr: 'ما هو SHA-256؟', hint: 'A cryptographic _', points: 50, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 23, answer: 'PRIVATE', question: 'What key must remain secret?', questionAr: 'ما المفتاح الذي يجب أن يبقى سرياً؟', hint: '_ key', points: 55, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 24, answer: 'PUBLIC', question: 'What key can be shared?', questionAr: 'ما المفتاح الذي يمكن مشاركته؟', hint: '_ key', points: 55, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 25, answer: 'NONCE', question: 'What miners search for?', questionAr: 'ماذا يبحث عنه المعدنون؟', hint: 'A _', points: 55, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 26, answer: 'GENESIS', question: 'The first block', questionAr: 'أول كتلة', hint: '_ block', points: 60, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 27, answer: 'DIFFICULTY', question: 'What adjusts mining hardness?', questionAr: 'ماذا يعدل صعوبة التعدين؟', hint: 'Mining _', points: 60, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 28, answer: 'REWARD', question: 'What miners earn for blocks?', questionAr: 'ماذا يكسب المعدنون للكتل؟', hint: 'Block _', points: 60, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 29, answer: 'CONSENSUS', question: 'How nodes agree on state?', questionAr: 'كيف يتفق العقد على الحالة؟', hint: 'Proof of Work _', points: 65, difficulty: 'hard', puzzleType: 'crypto' },
        { level: 30, answer: 'VICTORY', question: 'What awaits at level 30?', questionAr: 'ماذا ينتظرك في المستوى 30؟', hint: 'You win!', points: 100, difficulty: 'hard', puzzleType: 'riddle' },
        // Levels 31-40 (Expert +)
        { level: 31, answer: 'ETHEREUM', question: 'The second biggest crypto', questionAr: '第二大加密货币', hint: 'E_', points: 70, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 32, answer: 'SOLIDITY', question: 'Smart contract language', questionAr: '智能合约语言', hint: 'Solid_', points: 70, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 33, answer: 'BYZANTIUM', question: 'The famous hard fork', questionAr: '著名的硬分叉', hint: 'Byzantium _', points: 75, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 34, answer: 'LIGHTNING', question: 'Bitcoin layer 2 solution', questionAr: '比特币第二层解决方案', hint: '_ network', points: 75, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 35, answer: 'SHARDING', question: 'Ethereum scaling solution', questionAr: '以太坊扩展解决方案', hint: 'Sh_', points: 75, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 36, answer: 'STAKING', question: 'Proof of Stake mechanism', questionAr: '权益证明机制', hint: 'Sta_', points: 80, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 37, answer: 'ORACLE', question: 'External data source', questionAr: '外部数据源', hint: 'Chain_', points: 80, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 38, answer: 'AIRDROP', question: 'Free token distribution', questionAr: '免费代币分发', hint: 'Free _', points: 80, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 39, answer: 'WHALE', question: 'Large crypto holder', questionAr: '大型加密货币持有者', hint: 'Big _', points: 85, difficulty: 'expert', puzzleType: 'crypto' },
        { level: 40, answer: 'FORK', question: 'Blockchain split', questionAr: '区块链分裂', hint: 'Hard _', points: 85, difficulty: 'expert', puzzleType: 'crypto' },
        // Levels 41-50 (Master)
        { level: 41, answer: 'ZEROKNOWLEDGE', question: 'Prove without revealing', questionAr: '证明而不透露', hint: 'Zero-_ proof', points: 90, difficulty: 'master', puzzleType: 'crypto' },
        { level: 42, answer: 'HODL', question: 'Hold for the long term', questionAr: '长期持有', hint: 'HODL', points: 90, difficulty: 'master', puzzleType: 'crypto' },
        { level: 43, answer: 'DEFI', question: 'Decentralized finance', questionAr: '去中心化金融', hint: 'DeFi', points: 90, difficulty: 'master', puzzleType: 'crypto' },
        { level: 44, answer: 'NFT', question: 'Non-fungible token', questionAr: '非同质化代币', hint: 'N-F-T', points: 95, difficulty: 'master', puzzleType: 'crypto' },
        { level: 45, answer: 'METAMASK', question: 'Popular crypto wallet', questionAr: '流行的加密钱包', hint: 'Meta_', points: 95, difficulty: 'master', puzzleType: 'crypto' },
        { level: 46, answer: 'POLYGON', question: 'Ethereum scaling platform', questionAr: '以太坊扩展平台', hint: 'Poly_', points: 95, difficulty: 'master', puzzleType: 'crypto' },
        { level: 47, answer: 'BINANCE', question: 'Largest crypto exchange', questionAr: '最大加密货币交易所', hint: 'Binan_', points: 100, difficulty: 'master', puzzleType: 'crypto' },
        { level: 48, answer: 'COINBASE', question: 'US crypto exchange', questionAr: '美国加密货币交易所', hint: 'Coin_', points: 100, difficulty: 'master', puzzleType: 'crypto' },
        { level: 49, answer: 'KRAKEN', question: 'Famous exchange', questionAr: '著名交易所', hint: 'Kra_', points: 100, difficulty: 'master', puzzleType: 'crypto' },
        { level: 50, answer: 'CHAMPION', question: 'You are the champion!', questionAr: '你是冠军！', hint: 'Congratulations!', points: 200, difficulty: 'master', puzzleType: 'riddle' }
    ];
    for (const puzzle of defaultPuzzles) { await this.createPuzzle(puzzle); }
    console.log('50 default puzzles initialized');
};

module.exports = mongoose.model('Puzzle', puzzleSchema);