/**
 * Dynamic Puzzle Generator - 30 Levels
 * Levels 1-20: Regular puzzles
 * Levels 21-30: Epic 10-stage cryptographic puzzles
 */

const crypto = require('crypto');
const { generateEpicPuzzle, validateEpicAnswer, getEpicPuzzles } = require('../config/epicPuzzles');

// Generate seed from userId
function generateSeed(userId) {
  const hash = crypto.createHash('sha256').update(userId + Date.now()).digest('hex');
  return parseInt(hash.substring(0, 8), 16);
}

// Regular puzzle types for levels 1-20
const PUZZLE_TYPES = [
  // Levels 1-5: Easy - Basic math and patterns
  {
    type: 'sequence',
    generate: (seed) => {
      const start = 2 + (seed % 10);
      const diff = 3 + (seed % 5);
      const sequence = Array.from({length: 5}, (_, i) => start + i * diff);
      return {
        question: `ما هو الرقم التالي في المتسلسلة؟

${sequence.slice(0, 4).join(', ')}, ...`,
        answer: sequence[4].toString(),
        hint: `الفرق بين كل رقمين هو ${diff}`
      };
    }
  },
  {
    type: 'reverse',
    generate: (seed) => {
      const words = ['crypto', 'blockchain', 'bitcoin', 'ethereum', 'wallet'];
      const word = words[seed % words.length];
      return {
        question: `ما هو عكس الكلمة: ${word.split('').reverse().join('')}`,
        answer: word,
        hint: 'اقلب الحروف'
      };
    }
  },
  {
    type: 'sum',
    generate: (seed) => {
      const a = 10 + (seed % 20);
      const b = 5 + (seed % 15);
      return {
        question: `احسب: ${a} + ${b} × 2`,
        answer: (a + b * 2).toString(),
        hint: 'تذكر أولوية العمليات (ضرب قبل جمع)'
      };
    }
  },
  {
    type: 'binary',
    generate: (seed) => {
      const num = 5 + (seed % 20);
      return {
        question: `حوّل الرقم ${num} إلى نظام ثنائي (binary)`,
        answer: num.toString(2),
        hint: 'قسمة متكررة على 2'
      };
    }
  },
  {
    type: 'prime',
    generate: (seed) => {
      const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43];
      const idx = seed % (primes.length - 2);
      return {
        question: `ما هو العدد الأولي التالي لـ ${primes[idx]}؟`,
        answer: primes[idx + 1].toString(),
        hint: 'العدد الأولي لا يقبل القسمة إلا على 1 ونفسه'
      };
    }
  },
  // Levels 6-10: Medium - Ciphers and logic
  {
    type: 'caesar',
    generate: (seed) => {
      const shift = 3;
      const words = ['PUZZLE', 'CRYPTO', 'SECRET', 'HIDDEN', 'MASTER'];
      const word = words[seed % words.length];
      const encrypted = word.split('').map(c => 
        String.fromCharCode((c.charCodeAt(0) - 65 + shift) % 26 + 65)
      ).join('');
      return {
        question: `فك شيفرة قيصر (Caesar Cipher) مع إزاحة ${shift}:

${encrypted}`,
        answer: word,
        hint: `أزل ${shift} من كل حرف`
      };
    }
  },
  {
    type: 'xor',
    generate: (seed) => {
      const key = 5;
      const chars = ['A', 'B', 'C', 'D', 'E'];
      const selected = chars[seed % chars.length];
      const encrypted = String.fromCharCode(selected.charCodeAt(0) ^ key);
      return {
        question: `فك عملية XOR:

${encrypted} XOR ${key} = ?`,
        answer: selected,
        hint: 'XOR مع نفس المفتاح يُرجع الأصل'
      };
    }
  },
  {
    type: 'hash',
    generate: (seed) => {
      const inputs = ['hello', 'crypto', 'puzzle', 'secret', 'master'];
      const input = inputs[seed % inputs.length];
      const hash = crypto.createHash('md5').update(input).digest('hex').substring(0, 8);
      return {
        question: `ما المدخل الذي يعطي هذا الـ MD5 Hash؟

${hash}`,
        answer: input,
        hint: 'كلمات إنجليزية شائعة'
      };
    }
  },
  {
    type: 'pattern',
    generate: (seed) => {
      const patterns = [
        { arr: [1, 1, 2, 3, 5], ans: '8', hint: 'فيبوناتشي' },
        { arr: [2, 4, 8, 16], ans: '32', hint: 'مضاعفات 2' },
        { arr: [1, 4, 9, 16], ans: '25', hint: 'مربعات كاملة' },
        { arr: [1, 8, 27, 64], ans: '125', hint: 'مكعبات' },
        { arr: [3, 6, 9, 12], ans: '15', hint: 'مضاعفات 3' }
      ];
      const p = patterns[seed % patterns.length];
      return {
        question: `ما الرقم التالي؟

${p.arr.join(', ')}, ...`,
        answer: p.ans,
        hint: p.hint
      };
    }
  },
  {
    type: 'base64',
    generate: (seed) => {
      const words = ['data', 'code', 'key', 'hash', 'bit'];
      const word = words[seed % words.length];
      const encoded = Buffer.from(word).toString('base64');
      return {
        question: `فك ترميز Base64:

${encoded}`,
        answer: word,
        hint: 'استخدم Base64 decoder'
      };
    }
  },
  // Levels 11-15: Hard - Cryptography
  {
    type: 'rsa',
    generate: (seed) => {
      const p = 7, q = 11, e = 3;
      const n = p * q;
      const phi = (p - 1) * (q - 1);
      const msg = 5 + (seed % 10);
      const encrypted = Math.pow(msg, e) % n;
      return {
        question: `RSA Simple:

p = ${p}, q = ${q}, e = ${e}
الرسالة المشفرة: ${encrypted}

أوجد الرسالة الأصلية (msg)`,
        answer: msg.toString(),
        hint: `n = p×q = ${n}, φ = (p-1)(q-1) = ${phi}`
      };
    }
  },
  {
    type: 'hex',
    generate: (seed) => {
      const num = 100 + (seed % 200);
      return {
        question: `حوّل من عشري إلى سداسي عشري (Hex):

${num}`,
        answer: num.toString(16).toUpperCase(),
        hint: 'قسمة متكررة على 16'
      };
    }
  },
  {
    type: 'ascii',
    generate: (seed) => {
      const codes = [72, 69, 76, 76, 79]; // HELLO
      const offset = seed % 5;
      const shifted = codes.map(c => c + offset);
      return {
        question: `حوّل أكواد ASCII إلى نص:

${shifted.join(', ')}`,
        answer: String.fromCharCode(...shifted),
        hint: 'اربط كل رقم بحرف'
      };
    }
  },
  {
    type: 'vigenere',
    generate: (seed) => {
      const key = 'KEY';
      const plaintext = 'HELLO';
      const encrypted = plaintext.split('').map((c, i) => 
        String.fromCharCode((c.charCodeAt(0) - 65 + key.charCodeAt(i % key.length) - 65) % 26 + 65)
      ).join('');
      return {
        question: `فك شيفرة فيجينير (Vigenère):

المفتاح: ${key}
النص المشفر: ${encrypted}`,
        answer: plaintext,
        hint: 'اطرح المفتاح من النص'
      };
    }
  },
  {
    type: 'morse',
    generate: (seed) => {
      const morseCode = { 'S': '...', 'O': '---', 'H': '....', 'E': '.', 'T': '-', 'A': '.-', 'N': '-.' };
      const words = ['SOS', 'HELLO', 'TEST', 'CODE', 'NODE'];
      const word = words[seed % words.length];
      const encoded = word.split('').map(c => morseCode[c] || '').join(' ');
      return {
        question: `فك شيفرة مورس:

${encoded}`,
        answer: word,
        hint: 'نقاط وشرط'
      };
    }
  },
  // Levels 16-20: Very Hard - Multi-step
  {
    type: 'sha256',
    generate: (seed) => {
      const inputs = ['admin', 'user', 'root', 'test', 'pass'];
      const input = inputs[seed % inputs.length];
      const prefix = crypto.createHash('sha256').update(input).digest('hex').substring(0, 8);
      return {
        question: `ما المدخل الذي يبدأ بهذا SHA256؟

${prefix}...`,
        answer: input,
        hint: 'كلمات إنجليزية شائعة'
      };
    }
  },
  {
    type: 'aes',
    generate: (seed) => {
      const key = 'KEY';
      const iv = 'IV';
      const plaintext = 'SECRET';
      const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(key.padEnd(16, '0')), Buffer.from(iv.padEnd(16, '0')));
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return {
        question: `فك تشفير AES-128-CBC:

المفتاح: ${key}
IV: ${iv}
النص المشفر: ${encrypted.substring(0, 16)}...`,
        answer: plaintext,
        hint: 'استخدم مفتاح AES'
      };
    }
  },
  {
    type: 'doubleHash',
    generate: (seed) => {
      const inputs = ['hash', 'data', 'file', 'byte', 'word'];
      const input = inputs[seed % inputs.length];
      const double = crypto.createHash('sha256').update(crypto.createHash('sha256').update(input).digest('hex')).digest('hex').substring(0, 8);
      return {
        question: `ما المدخل الذي يعطي هذا الـ Double SHA256؟

${double}...`,
        answer: input,
        hint: 'SHA256(SHA256(input))'
      };
    }
  },
  {
    type: 'base58',
    generate: (seed) => {
      const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      const input = '1' + base58Chars[seed % base58Chars.length];
      const hash = crypto.createHash('sha256').update(input).digest('hex').substring(0, 8);
      return {
        question: `ما الحرف الناقص في Base58؟

النص: 1?
Hash يبدأ بـ: ${hash}`,
        answer: base58Chars[seed % base58Chars.length],
        hint: 'أحرف Base58 (بدون 0, O, I, l)'
      };
    }
  },
  {
    type: 'merkle',
    generate: (seed) => {
      const left = 'A';
      const right = 'B';
      const combined = crypto.createHash('sha256').update(left + right).digest('hex').substring(0, 8);
      return {
        question: `أنشئ Merkle Root:

البيانات: [A, B]
Hash(A + B) = ?`,
        answer: combined,
        hint: 'اربط A و B ثم哈希'
      };
    }
  }
];

// Generate question for a specific level
function generateQuestion(level, seed, userId = null, history = {}) {
  // For epic levels (21-30), use the epic puzzle system
  if (level >= 21 && level <= 30) {
    return generateEpicPuzzle(level, seed, userId, history);
  }
  
  // For regular levels (1-20)
  const puzzleIndex = (level - 1) % PUZZLE_TYPES.length;
  const puzzle = PUZZLE_TYPES[puzzleIndex];
  
  const data = puzzle.generate(seed);
  
  return {
    level,
    type: puzzle.type,
    question: data.question,
    hint: data.hint,
    answer: data.answer,
    difficulty: level <= 5 ? 'easy' : level <= 10 ? 'medium' : level <= 15 ? 'hard' : 'very_hard'
  };
}

// Validate answer
function validateAnswer(answer, level, seed, history = {}) {
  // For epic levels
  if (level >= 21 && level <= 30) {
    const x1 = 17 + (level * 3) + (seed % 10);
    const x2 = 31 + (level * 5) + (seed % 15);
    const k = `MATH${level}`;
    const paths = ['A', 'B', 'C', 'D'];
    const path = paths[level % 4];
    const r1 = 23 + level;
    const r2 = 47 + level * 2;
    const r3 = 59 + level * 3;
    
    return validateEpicAnswer(answer, level, { x1, x2, k, path, r1, r2, r3 });
  }
  
  // For regular levels
  const puzzleIndex = (level - 1) % PUZZLE_TYPES.length;
  const puzzle = PUZZLE_TYPES[puzzleIndex];
  const data = puzzle.generate(seed);
  
  const userAnswer = answer.toString().trim().toLowerCase();
  const correctAnswer = data.answer.toLowerCase();
  
  if (userAnswer === correctAnswer) {
    const isFinal = level === 30;
    return {
      valid: true,
      correct: true,
      isFinal,
      isReward: isFinal,
      nextKey: isFinal ? 'EPIC_SOLVER_' + Date.now() : null,
      message: isFinal ? '🎉 تهانينا! أكملت اللعبة!' : 'إجابة صحيحة!'
    };
  }
  
  return {
    valid: false,
    correct: false,
    message: 'إجابة خاطئة. حاول مرة أخرى.'
  };
}

// Get total levels
const TOTAL_LEVELS = 30;

module.exports = {
  generateSeed,
  generateQuestion,
  validateAnswer,
  getEpicPuzzles,
  TOTAL_LEVELS,
  PUZZLE_TYPES
};
