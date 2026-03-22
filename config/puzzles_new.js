const crypto = require('crypto');

/**
 * Puzzle Configuration - Dynamic AI-Resistant Puzzle System
 * 
 * Features:
 * - 30 levels with increasing complexity
 * - AI-resistant questions (personal, time-based, creative)
 * - Unique path per user
 * - Accumulation system - answers build on each other
 * - Final question combines everything
 */

const puzzles = {
  // ═══════════════════════════════════════════════════════
  // المستوى الأول (1-10): أسئلة بسيطة - التعلم
  // ═══════════════════════════════════════════════════════
  
  'PL_1': {
    type: 'personal_info',
    question: 'ما هو اسم حيوانك الأليف الأول؟ اكتب الاسم بالإنجليزية',
    hint: 'فكر في أول حيوان كان لديك',
    storage_key: 'pet_name',
    difficulty: 1,
    attempts: 3
  },
  
  'PL_2': {
    type: 'simple_math',
    question: 'كم يساوي 7 × 8 + 12؟',
    hint: 'اضرب أولاً ثم اجمع',
    storage_key: 'math_1',
    difficulty: 1,
    attempts: 3
  },
  
  'PL_3': {
    type: 'word_puzzle',
    question: 'ما هو عكس كلمة "Dark"؟',
    hint: 'ضد الظلام',
    storage_key: 'word_1',
    difficulty: 1,
    attempts: 3
  },
  
  'PL_4': {
    type: 'date_based',
    question: 'ما هو اليوم الحالي من الأسبوع؟ (اكتب بالإنجليزية)',
    hint: 'Monday, Tuesday, etc.',
    storage_key: 'day_of_week',
    time_based: true,
    difficulty: 1,
    attempts: 3
  },
  
  'PL_5': {
    type: 'sequence',
    question: 'ما هو الرقم التالي: 2, 4, 8, 16, ?',
    hint: 'اضرب في 2',
    storage_key: 'sequence_1',
    difficulty: 1,
    attempts: 3
  },

  // ═══════════════════════════════════════════════════════
  // المستوى الثاني (11-20): أسئلة متوسطة - التعقيد يزداد
  // ═══════════════════════════════════════════════════════
  
  'PL_11': {
    type: 'accumulation',
    question: 'اجمع الإجابات السابقة: (حيوانك الأليف) + (نتيجة الرياضيات) + (عكس Dark)',
    hint: 'اربط الإجابات ببعض',
    storage_key: 'accum_1',
    uses_previous: ['pet_name', 'math_1', 'word_1'],
    difficulty: 2,
    attempts: 3
  },
  
  'PL_12': {
    type: 'encryption',
    question: 'شفر هذه الكلمة باستخدام Caesar cipher (+3): "HELLO"',
    hint: 'كل حرف + 3',
    storage_key: 'cipher_1',
    difficulty: 2,
    attempts: 3
  },
  
  'PL_13': {
    type: 'time_based',
    question: 'كم الساعة الآن في NYC؟ (format: HH:MM)',
    hint: 'توقيت نيويورك = UTC - 5',
    storage_key: 'nyc_time',
    time_based: true,
    difficulty: 2,
    attempts: 3
  },
  
  'PL_14': {
    type: 'binary',
    question: 'حوّل الرقم 42 إلى نظام ثنائي (Binary)',
    hint: '2^5=32, 2^3=8, 2^1=2',
    storage_key: 'binary_1',
    difficulty: 2,
    attempts: 3
  },
  
  'PL_15': {
    type: 'hash_puzzle',
    question: 'ما هو الحرف الأول من اسمك + الحرف الأخير من اسمك؟',
    hint: 'اجمع الحرفين',
    storage_key: 'name_puzzle',
    difficulty: 2,
    attempts: 3
  },

  // ═══════════════════════════════════════════════════════
  // المستوى الثالث (21-30): أسئلة معقدة - AI لا يستطيع
  // ═══════════════════════════════════════════════════════
  
  'PL_21': {
    type: 'complex_accumulation',
    question: 'اجمع: (إجابة السؤال 11) + (إجابة السؤال 12) + (إجابة السؤال 13) + (إجابة السؤال 14)',
    hint: 'اربط كل شيء',
    storage_key: 'complex_1',
    uses_previous: ['accum_1', 'cipher_1', 'nyc_time', 'binary_1'],
    difficulty: 3,
    attempts: 3
  },
  
  'PL_22': {
    type: 'creative',
    question: 'اكتب جملة من 5 كلمات تحتوي على حرفين متتاليين متشابهين (مثل: "book", "coffee")',
    hint: 'كلمتان على الأقل',
    storage_key: 'creative_1',
    difficulty: 3,
    attempts: 3
  },
  
  'PL_23': {
    type: 'base64',
    question: 'شفر هذه الجملة إلى Base64: "SECRET"',
    hint: 'استخدم Base64 encoder',
    storage_key: 'base64_1',
    difficulty: 3,
    attempts: 3
  },
  
  'PL_24': {
    type: 'hex_conversion',
    question: 'حوّل الرقم 255 إلى hexadecimal',
    hint: 'أقصى قيمة لبايت',
    storage_key: 'hex_1',
    difficulty: 3,
    attempts: 3
  },
  
  'PL_25': {
    type: 'reverse_engineering',
    question: 'إذا كان: A=1, B=2, C=3... ما مجموع أحرف كلمة "GAME"؟',
    hint: 'G=7, A=1, M=13, E=5',
    storage_key: 'letter_sum',
    difficulty: 3,
    attempts: 3
  },

  // ═══════════════════════════════════════════════════════
  // السؤال الأخير (30): التجميع النهائي
  // ═══════════════════════════════════════════════════════
  
  'PL_30': {
    type: 'final_accumulation',
    question: '🎯 السؤال الأخير!\n\nاجمع كل إجاباتك السابقة مع:\n1. أضف "mrabt" في البداية\n2. أضف رقم السؤال الحالي (30) في النهاية\n3. أضف عمرك الذي أدخلته في السؤال الأول\n\nكون الجملة النهائية وأرسلها',
    hint: 'مثال: mrabt[كل_الإجابات]30[عمرك]',
    storage_key: 'final_answer',
    uses_previous: ['pet_name', 'math_1', 'word_1', 'day_of_week', 'sequence_1', 'accum_1', 'cipher_1', 'nyc_time', 'binary_1', 'name_puzzle', 'complex_1', 'creative_1', 'base64_1', 'hex_1', 'letter_sum'],
    difficulty: 3,
    attempts: 3,
    is_final: true
  }
};

// Generate dynamic puzzles based on user ID
function generateUserPuzzles(userId) {
  const userHash = crypto.createHash('sha256').update(userId).digest('hex');
  const userNum = parseInt(userHash.substring(0, 8), 16);
  
  const userPuzzles = [];
  const puzzleKeys = Object.keys(puzzles);
  
  // ترتيب الألغاز حسب الصعوبة
  const sortedPuzzles = puzzleKeys
    .map(key => ({ key, ...puzzles[key] }))
    .sort((a, b) => a.difficulty - b.difficulty);
  
  // اختيار 30 لغز لكل مستخدم (فريد)
  for (let i = 0; i < 30; i++) {
    const puzzleIndex = (userNum + i) % sortedPuzzles.length;
    const basePuzzle = sortedPuzzles[puzzleIndex];
    
    userPuzzles.push({
      id: `PZ_${i + 1}`,
      level: i + 1,
      type: basePuzzle.type,
      question: basePuzzle.question,
      hint: basePuzzle.hint,
      storage_key: basePuzzle.storage_key,
      difficulty: basePuzzle.difficulty,
      attempts: basePuzzle.attempts,
      max_attempts: basePuzzle.attempts,
      time_based: basePuzzle.time_based || false,
      uses_previous: basePuzzle.uses_previous || [],
      is_final: basePuzzle.is_final || false,
      status: i === 0 ? 'active' : 'locked',
      user_answers: [],
      completed: false
    });
  }
  
  return userPuzzles;
}

module.exports = { puzzles, generateUserPuzzles };
