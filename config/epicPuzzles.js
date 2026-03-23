/**
 * Epic Puzzle Configuration - Levels 21-30
 * 10-Stage cryptographic puzzle system
 */

const crypto = require('crypto');
const { 
  solveEpicPuzzle, 
  stage1_initKeys, 
  stage2_generateChain, 
  stage3_xorWithPrimes,
  stage4_mathSeries,
  stage5_toChars,
  stage6_conditionalPath,
  stage7_repetition,
  stage8_extractSymbols,
  stage9_gradualBuild,
  stage10_finalText,
  PRIMES
} = require('./epicPuzzle');

// Generate unique puzzle for each user
function generateEpicPuzzle(level, seed, userId = null, history = {}) {
  // Generate inputs based on level and seed
  const x1 = 17 + (level * 3) + (seed % 10);
  const x2 = 31 + (level * 5) + (seed % 15);
  const k = `MATH${level}`;
  
  // Path selection based on level
  const paths = ['A', 'B', 'C', 'D'];
  const path = paths[level % 4];
  
  // R values based on level
  const r1 = 23 + level;
  const r2 = 47 + level * 2;
  const r3 = 59 + level * 3;
  
  // Solve the puzzle to get the answer
  const solution = solveEpicPuzzle(x1, x2, k, path);
  
  // Generate the question for this level
  const question = generateQuestion(level, x1, x2, k, path, r1, r2, r3);
  
  return {
    level,
    type: 'epic',
    question: question.text,
    hint: question.hint,
    inputs: { x1, x2, k, path, r1, r2, r3 },
    solution: solution.finalText,
    path,
    stages: 10,
    difficulty: 'epic'
  };
}

// Generate question text for each level
function generateQuestion(level, x1, x2, k, path, r1, r2, r3) {
  const questions = {
    21: {
      text: `🔐 **مرحلة 21 -初始化 المفتاح**

قم بحل النظام المشفر:

**المدخلات:**
- X1 = ${x1}
- X2 = ${x2}
- K = "${k}"

**المطلوب:**
استخدم SHA256 لتوليد مفاتيح أولية من خلال:
Hash1 = SHA256(K + X1)
Hash2 = SHA256(K + X2)

**أدخل أول 8 أحرف من Hash1:**`,
      hint: `تذكر: عملية串联 (concatenation) تأتي قبل التشفير`
    },
    22: {
      text: `🔐 **مرحلة 22 - توليد السلسلة**

**المدخلات:**
- Hash1 = SHA256("${k}${x1}")
- Hash2 = SHA256("${k}${x2}")

**العملية:**
حوّل الـ Hash إلى أرقام عشرية وأ生成 سلسلة من 10-15 رقم

**أدخل أول 10 أرقام من السلسلة:**`,
      hint: `parseInt(hexString, 16)`
    },
    23: {
      text: `🔐 **مرحلة 23 - XOR مع الأعداد الأولية**

**المدخلات:**
- السلسلة من المرحلة السابقة
- P1 = 7

**العملية:**
XOR كل رقم مع P1² (أي 49)

**أدخل السلسلة المشفرة (أول 10 أرقام):**`,
      hint: `7² = 49، ثم 49 % 10 = 9`
    },
    24: {
      text: `🔐 **مرحلة 24 - السلسلة الرياضية**

**المدخلات:**
- S0 = ${x1} + ${x2} = ${x1 + x2}
- Hash من المرحلة 22

**المطلوب:**
احسب:
S1 = (S0³ + Hash_mod + 2²) mod 9973
S2 = (S1³ + Hash_mod + 3²) mod 9973

**أدخل S1 و S2 مفصولين بفاصلة:**`,
      hint: `استخدم parseInt(hash.substring(0,4), 16) % 10000`
    },
    25: {
      text: `🔐 **مرحلة 25 - تحويل إلى أحرف**

**المدخلات:**
- السلسلة: [${[48, 2341, 4523, 1234, 5678, 9012, 3456, 7890, 1234, 5678].join(', ')}]

**العملية:**
لكل رقم: حرف = (رقم mod 26) + 65
(A=65, B=66, ...)

**أدخل الأحرف الناتجة:**`,
      hint: `48 % 26 = 48 → 48 + 65 = 113 = 'q'`
    },
    26: {
      text: `🔐 **مرحلة 26 - المسارات الشرطية**

**المدخلات:**
- الأحرف: G, T, Q, B, M, R, D, L, F, A
- المسار: ${path}

**المطلوب:**
- **Path A**: XOR إضافي
- **Path B**: Caesar Shift (+3)
- **Path C**: دمج مع Hash
- **Path D**: عكس الأحرف

**أدخل النتيجة:**`,
      hint: path === 'A' ? 'XOR مع 7, 14, 21...' : 
             path === 'B' ? 'Caesar Shift: أضف 3 لكل حرف' :
             path === 'C' ? 'دمج مع SHA256' : 'عكس الترتيب'
    },
    27: {
      text: `🔐 **مرحلة 27 - التكرار الجزئي**

**المدخلات:**
- R1 = ${r1}, R2 = ${r2}, R3 = ${r3}
- السلسلة من المرحلة السابقة

**العملية:**
كرر 200-500 مرة:
S'n = (S'n-1 + R_i³ + Hash_n) mod 104729

**أدخل طول السلسلة النهائية:**`,
      hint: `R1³ = ${r1**3}، العملية تتكرر 200+ مرة`
    },
    28: {
      text: `🔐 **مرحلة 28 - استخراج الرموز**

**المدخلات:**
- السلسلة الضخمة من المرحلة السابقة

**العملية:**
حوّل كل عنصر إلى حرف (mod 26)

**أدخل أول 20 حرف:**`,
      hint: `نفس عملية المرحلة 25`
    },
    29: {
      text: `🔐 **مرحلة 29 - البناء التدريجي**

**المدخلات:**
- السلسلة النهائية
- Hash من المرحلة 6

**العملية:**
فك التشفير: Caesar Shift (-3) + XOR مع Hash

**أدخل أول 20 حرف بعد فك التشفير:**`,
      hint: `عكس عمليات المرحلة 6`
    },
    30: {
      text: `🔐 **مرحلة 30 - النص النهائي**

🎉 **المرحلة الأخيرة!**

**المطلوب:**
اجمع كل الرسائل الجزئية للحصول على النص النهائي

**أدخل النص النهائي (البريد الإلكتروني):**`,
      hint: `اجمع كل الأجزاء من المرحلة 29`
    }
  };
  
  return questions[level] || { text: 'Unknown level', hint: 'No hint' };
}

// Validate answer
function validateEpicAnswer(answer, level, inputs) {
  const { x1, x2, k, path, r1, r2, r3 } = inputs;
  
  // Solve the puzzle
  const solution = solveEpicPuzzle(x1, x2, k, path);
  
  // Check answer (case insensitive, trim whitespace)
  const userAnswer = answer.toString().trim().toLowerCase();
  const correctAnswer = solution.finalText.toLowerCase();
  
  // Allow partial matches for intermediate levels
  if (level < 30) {
    // For intermediate levels, check if answer is close
    const similarity = calculateSimilarity(userAnswer, correctAnswer.substring(0, userAnswer.length));
    if (similarity > 0.7) {
      return { valid: true, isFinal: false, nextKey: correctAnswer };
    }
  }
  
  // Exact match
  if (userAnswer === correctAnswer || userAnswer.includes(correctAnswer) || correctAnswer.includes(userAnswer)) {
    return { 
      valid: true, 
      isFinal: level === 30,
      nextKey: level === 30 ? null : correctAnswer
    };
  }
  
  return { 
    valid: false, 
    message: 'إجابة خاطئة. راجع العمليات الرياضية.' 
  };
}

// Calculate string similarity
function calculateSimilarity(str1, str2) {
  if (str1.length === 0 || str2.length === 0) return 0;
  
  let matches = 0;
  const minLen = Math.min(str1.length, str2.length);
  
  for (let i = 0; i < minLen; i++) {
    if (str1[i] === str2[i]) matches++;
  }
  
  return matches / Math.max(str1.length, str2.length);
}

// Get all epic puzzle levels
function getEpicPuzzles(seed) {
  const puzzles = {};
  
  for (let level = 21; level <= 30; level++) {
    puzzles[level] = generateEpicPuzzle(level, seed);
  }
  
  return puzzles;
}

module.exports = {
  generateEpicPuzzle,
  generateQuestion,
  validateEpicAnswer,
  getEpicPuzzles,
  solveEpicPuzzle
};
