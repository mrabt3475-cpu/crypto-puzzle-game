const crypto = require('crypto');

// Generate unique seed for each user
function generateSeed(userId) {
  return crypto.createHash('sha256').update(userId + Date.now()).digest('hex').substring(0, 16);
}

// Generate dynamic question based on seed and previous answer
function generateQuestion(level, seed, previousAnswer = null) {
  const questions = {
    1: {
      type: 'personal_age',
      question: 'ما هو عمرك؟ (أدخل رقمًا صحيحًا)',
      hint: 'سيُستخدم هذا الرقم لتوليد مفتاح السؤال التالي',
      generate: (seed) => ({ seed: seed }),
      validate: (answer, data, seed) => {
        const age = parseInt(answer);
        if (isNaN(age) || age < 1 || age > 150) return { valid: false, message: 'عمر غير صالح' };
        const nextKey = crypto.createHash('sha256').update(seed + age).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: String(age).charAt(0) };
      }
    },
    2: {
      type: 'personal_name',
      question: 'ما هو اسمك الأول؟ (حروف إنجليزية فقط)',
      hint: 'سيُدمج مع مفتاح السؤال السابق',
      generate: (seed) => ({ seed }),
      validate: (answer, data, seed) => {
        const name = answer.trim().toUpperCase().replace(/[^A-Z]/g, '');
        if (name.length < 2) return { valid: false, message: 'اسم قصير جداً' };
        const nextKey = crypto.createHash('sha256').update(seed + name).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: name.charAt(0) };
      }
    },
    3: {
      type: 'math_modular',
      question: '',
      hint: 'استخدم العمليات الرياضية الأساسية',
      generate: (seed) => {
        const num = parseInt(seed.substring(0, 4), 16) % 100 + 10;
        const multiplier = parseInt(seed.substring(4, 6), 16) % 10 + 2;
        const modulus = 97;
        return { question: `حل المعادلة: (${num} × ${multiplier}) mod ${modulus} = ?`, num, multiplier, modulus };
      },
      validate: (answer, data, seed) => {
        const correct = (data.num * data.multiplier) % data.modulus;
        const userAns = parseInt(answer);
        if (userAns !== correct) return { valid: false, message: `الإجابة الصحيحة هي ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: String(correct).charAt(0) };
      }
    },
    4: {
      type: 'math_power',
      question: '',
      hint: 'ترتيب العمليات مهم',
      generate: (seed) => {
        const base = parseInt(seed.substring(0, 2), 16) % 5 + 2;
        const exp = parseInt(seed.substring(2, 4), 16) % 4 + 2;
        const modulus = 100;
        return { question: `احسب: (${base}^${exp}) mod ${modulus}`, base, exp, modulus };
      },
      validate: (answer, data, seed) => {
        const correct = Math.pow(data.base, data.exp) % data.modulus;
        const userAns = parseInt(answer);
        if (userAns !== correct) return { valid: false, message: `الإجابة الصحيحة هي ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: String(correct).slice(-1) };
      }
    },
    5: {
      type: 'string_ascii',
      question: '',
      hint: 'حوّل الأحرف لأرقام ASCII واجمعها',
      generate: (seed) => ({ question: 'احسب مجموع ASCII لـ: PUZZLE', word: 'PUZZLE' }),
      validate: (answer, data, seed) => {
        const correct = data.word.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const userAns = parseInt(answer);
        if (userAns !== correct) return { valid: false, message: `مجموع ASCII هو ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: String(correct).charAt(0) };
      }
    },
    6: {
      type: 'hash_sha256',
      question: '',
      hint: 'استخدم أي أداة hash online',
      generate: (seed) => {
        const input = 'CRYPTO' + seed.substring(0, 4);
        return { question: `ما هو SHA256 hash لـ: "${input}"? (أول 8 أحرف)`, input };
      },
      validate: (answer, data, seed) => {
        const correct = crypto.createHash('sha256').update(data.input).digest('hex').substring(0, 8);
        if (answer.toLowerCase() !== correct) return { valid: false, message: `أول 8 أحرف هي: ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: correct.charAt(0) };
      }
    },
    7: {
      type: 'xor_cipher',
      question: '',
      hint: 'XOR يعكس العملية',
      generate: (seed) => {
        const key = 0xA5;
        const plaintext = 'HI';
        const encrypted = Buffer.from(plaintext).reduce((acc, byte) => acc ^ key, 0);
        return { question: `إذا كان plaintext "HI" مشفر بـ XOR مع 0x${key.toString(16).toUpperCase()}، ما هي القيمة المشفرة؟ (hex)`, key, plaintext, encrypted };
      },
      validate: (answer, data, seed) => {
        const userAns = answer.toUpperCase().replace(/^0X/, '');
        const correct = data.encrypted.toString(16).toUpperCase();
        if (userAns !== correct) return { valid: false, message: `الإجابة: 0x${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: correct.charAt(0) };
      }
    },
    8: {
      type: 'base64_encode',
      question: '',
      hint: 'استخدم Base64 encoding',
      generate: (seed) => ({ question: 'ما هو Base64 encoding لـ: "KEY"?', text: 'KEY' }),
      validate: (answer, data, seed) => {
        const correct = Buffer.from(data.text).toString('base64');
        if (answer.trim() !== correct) return { valid: false, message: `الإجابة: ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: correct.charAt(0) };
      }
    },
    9: {
      type: 'hex_to_decimal',
      question: '',
      hint: 'حوّل من hex لعشري',
      generate: (seed) => {
        const hex = '0x' + seed.substring(0, 4);
        return { question: `حوّل ${hex} للعشري`, hex };
      },
      validate: (answer, data, seed) => {
        const correct = parseInt(data.hex);
        const userAns = parseInt(answer);
        if (userAns !== correct) return { valid: false, message: `القيمة العشرية: ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: String(correct).charAt(0) };
      }
    },
    10: {
      type: 'sequence_pattern',
      question: '',
      hint: 'ابحث عن النمط: كل رقم ضعف السابق + 1',
      generate: (seed) => {
        const start = parseInt(seed.substring(0, 2), 16) % 5 + 1;
        const sequence = [start];
        for (let i = 0; i < 4; i++) sequence.push(sequence[sequence.length - 1] * 2 + 1);
        return { question: `ما هو الرقم التالي في المتسلسلة: ${sequence.join(', ')}, ?`, sequence };
      },
      validate: (answer, data, seed) => {
        const correct = data.sequence[data.sequence.length - 1] * 2 + 1;
        const userAns = parseInt(answer);
        if (userAns !== correct) return { valid: false, message: `الرقم التالي هو: ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: String(correct).charAt(0) };
      }
    },
    11: {
      type: 'cumulative_key',
      question: 'اجمع مفتاح السؤال الأول + مفتاح السؤال الخامس؟ (اكتب الرقم فقط)',
      hint: 'المفاتيح هي أرقام',
      generate: (seed) => ({ seed }),
      validate: (answer, data, seed, history) => {
        if (!history[1] || !history[5]) return { valid: false, message: 'لا يمكنك حل هذا بدون إجابات سابقة' };
        const key1 = parseInt(history[1].partialKey || '0', 36);
        const key5 = parseInt(history[5].partialKey || '0', 36);
        const correct = key1 + key5;
        const userAns = parseInt(answer);
        if (userAns !== correct) return { valid: false, message: `المجموع هو: ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: String(correct).charAt(0) };
      }
    },
    12: {
      type: 'reverse_string',
      question: '',
      hint: 'اقلب الأحرف',
      generate: (seed) => {
        const word = 'BLOCK' + seed.substring(0, 2);
        return { question: `اقلب الكلمة: ${word}`, word };
      },
      validate: (answer, data, seed) => {
        const correct = data.word.split('').reverse().join('');
        if (answer.toUpperCase() !== correct) return { valid: false, message: `الإجابة: ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: correct.charAt(0) };
      }
    },
    13: {
      type: 'md5_partial',
      question: '',
      hint: 'MD5 hash - أول 4 أحرف فقط',
      generate: (seed) => {
        const input = 'GAME' + seed.substring(0, 2);
        return { question: `ما أول 4 أحرف من MD5 hash لـ "${input}"?`, input };
      },
      validate: (answer, data, seed) => {
        const correct = crypto.createHash('md5').update(data.input).digest('hex').substring(0, 4);
        if (answer.toLowerCase() !== correct) return { valid: false, message: `أول 4 أحرف: ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: correct.charAt(0) };
      }
    },
    14: {
      type: 'prime_check',
      question: '',
      hint: 'هل الرقم أولي؟ (نعم/لا)',
      generate: (seed) => {
        const num = parseInt(seed.substring(0, 4), 16) % 100 + 10;
        return { question: `هل ${num} عدد أولي؟`, num };
      },
      validate: (answer, data, seed) => {
        const isPrime = (n) => {
          if (n < 2) return false;
          for (let i = 2; i <= Math.sqrt(n); i++) if (n % i === 0) return false;
          return true;
        };
        const correct = isPrime(data.num) ? 'نعم' : 'لا';
        if (answer.toLowerCase() !== correct.toLowerCase() && answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'no') {
          return { valid: false, message: `الإجابة: ${correct}` };
        }
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: correct.charAt(0) };
      }
    },
    15: {
      type: 'composite_keys',
      question: 'ادخل مفتاح السؤال الأول ثم مفتاح السؤال الثاني؟ (مثال: AB)',
      hint: 'اربط المفتاحين مع بعض',
      generate: (seed) => ({ seed }),
      validate: (answer, data, seed, history) => {
        if (!history[1] || !history[2]) return { valid: false, message: 'لا يمكنك حل هذا بدون إجابات سابقة' };
        const key1 = history[1].partialKey || 'X';
        const key2 = history[2].partialKey || 'X';
        const correct = key1 + key2;
        if (answer.toUpperCase() !== correct) return { valid: false, message: `اربط: ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: correct.charAt(0) };
      }
    },
    16: {
      type: 'blockchain_tx_hash',
      question: '',
      hint: 'صنع hash للمعاملة',
      generate: (seed) => {
        const tx = `{"from":"A","to":"B","amount":${parseInt(seed.substring(0,2),16)+1}}`;
        return { question: `ما SHA256 hash لـ: ${tx}? (أول 6 أحرف)`, tx };
      },
      validate: (answer, data, seed) => {
        const correct = crypto.createHash('sha256').update(data.tx).digest('hex').substring(0, 6);
        if (answer.toLowerCase() !== correct) return { valid: false, message: `أول 6 أحرف: ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: correct.charAt(0) };
      }
    },
    17: {
      type: 'rsa_modulus',
      question: '',
      hint: 'RSA: p × q = n',
      generate: (seed) => ({ question: 'في RSA، إذا كان p=61 و q=53، ما هو n؟', p: 61, q: 53 }),
      validate: (answer, data, seed) => {
        const correct = data.p * data.q;
        const userAns = parseInt(answer);
        if (userAns !== correct) return { valid: false, message: `n = ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: String(correct).charAt(0) };
      }
    },
    18: {
      type: 'fibonacci',
      question: '',
      hint: 'Fibonacci: كل رقم مجموع الرقمين السابقتين',
      generate: (seed) => {
        const n = parseInt(seed.substring(0, 2), 16) % 5 + 5;
        const fib = [1, 1];
        for (let i = 2; i < n; i++) fib.push(fib[i-1] + fib[i-2]);
        return { question: `ما الرقم ${n} في متسلسلة Fibonacci؟`, n, fib };
      },
      validate: (answer, data, seed) => {
        const correct = data.fib[data.n - 1];
        const userAns = parseInt(answer);
        if (userAns !== correct) return { valid: false, message: `الرقم ${data.n} هو: ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: String(correct).charAt(0) };
      }
    },
    19: {
      type: 'binary_to_decimal',
      question: '',
      hint: 'حوّل من ثنائي لعشري',
      generate: (seed) => {
        const binary = '1010' + parseInt(seed.substring(0, 2), 16).toString(2).padStart(4, '0').substring(0, 2);
        return { question: `حوّل ${binary} للعشري`, binary };
      },
      validate: (answer, data, seed) => {
        const correct = parseInt(data.binary, 2);
        const userAns = parseInt(answer);
        if (userAns !== correct) return { valid: false, message: `القيمة: ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: String(correct).charAt(0) };
      }
    },
    20: {
      type: 'hmac_simple',
      question: '',
      hint: 'HMAC-SHA256 with key "SECRET"',
      generate: (seed) => {
        const msg = 'DATA' + seed.substring(0, 2);
        return { question: `ما أول 4 أحرف من HMAC-SHA256("${msg}", key="SECRET")?`, msg, key: 'SECRET' };
      },
      validate: (answer, data, seed) => {
        const hmac = crypto.createHmac('sha256', data.key).update(data.msg).digest('hex');
        const correct = hmac.substring(0, 4);
        if (answer.toLowerCase() !== correct) return { valid: false, message: `أول 4 أحرف: ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: correct.charAt(0) };
      }
    },
    21: {
      type: 'dynamic_equation',
      question: '',
      hint: 'المعادلة تعتمد على إجاباتك السابقة',
      generate: (seed, prevAnswer, history) => {
        const prevSum = Object.values(history || {}).reduce((sum, h) => sum + (parseInt(h.partialKey || '0', 36) || 0), 0);
        const a = (prevSum % 20) + 5;
        const b = parseInt(seed.substring(0, 2), 16) % 10 + 1;
        return { question: `حل: ${a}x + ${b} = ${a * 5 + b}، ما قيمة x؟`, a, b };
      },
      validate: (answer, data, seed) => {
        const correct = 5;
        const userAns = parseInt(answer);
        if (userAns !== correct) return { valid: false, message: `x = ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: String(correct).charAt(0) };
      }
    },
    22: {
      type: 'merkle_root_simple',
      question: '',
      hint: 'Hash(A + B) حيث + يعني concatenate',
      generate: (seed) => {
        const left = 'TX1' + seed.substring(0, 2);
        const right = 'TX2' + seed.substring(2, 4);
        return { question: `احسب Merkle root (أول 4 أحرف)`, left, right };
      },
      validate: (answer, data, seed) => {
        const leftHash = crypto.createHash('sha256').update(data.left).digest('hex');
        const rightHash = crypto.createHash('sha256').update(data.right).digest('hex');
        const merkle = crypto.createHash('sha256').update(leftHash + rightHash).digest('hex').substring(0, 4);
        if (answer.toLowerCase() !== merkle) return { valid: false, message: `أول 4 أحرف: ${merkle}` };
        const nextKey = crypto.createHash('sha256').update(seed + merkle).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: merkle.charAt(0) };
      }
    },
    23: {
      type: 'private_key_derive',
      question: '',
      hint: 'HD Wallet: key = hash(seed + path)',
      generate: (seed) => {
        const path = "m/44'/0'/0'/0/0";
        return { question: `ما أول 4 أحرف من derived key؟`, path };
      },
      validate: (answer, data, seed) => {
        const derived = crypto.createHash('sha256').update(seed.substring(0, 4) + data.path).digest('hex').substring(0, 4);
        if (answer.toLowerCase() !== derived) return { valid: false, message: `أول 4 أحرف: ${derived}` };
        const nextKey = crypto.createHash('sha256').update(seed + derived).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: derived.charAt(0) };
      }
    },
    24: {
      type: 'signature_verify',
      question: '',
      hint: 'ECDSA signature: r, s',
      generate: (seed) => ({ question: 'ما أول 4 أحرف من signature؟', msg: 'PAYMENT' + seed.substring(0, 2) }),
      validate: (answer, data, seed) => {
        const sig = crypto.createHash('sha256').update('abc123def456').digest('hex').substring(0, 4);
        if (answer.toLowerCase() !== sig) return { valid: false, message: `أول 4 أحرف: ${sig}` };
        const nextKey = crypto.createHash('sha256').update(seed + sig).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: sig.charAt(0) };
      }
    },
    25: {
      type: 'gas_calculation',
      question: '',
      hint: 'Gas = baseFee + (data * 16)',
      generate: (seed) => {
        const baseFee = 21000;
        const dataBytes = parseInt(seed.substring(0, 2), 16);
        return { question: `احسب gas: baseFee=${baseFee}, data=${dataBytes} bytes`, baseFee, dataBytes };
      },
      validate: (answer, data, seed) => {
        const correct = data.baseFee + (data.dataBytes * 16);
        const userAns = parseInt(answer);
        if (userAns !== correct) return { valid: false, message: `Gas = ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: String(correct).charAt(0) };
      }
    },
    26: {
      type: 'token_transfer',
      question: '',
      hint: 'ERC-20: balance - amount = newBalance',
      generate: (seed) => {
        const balance = parseInt(seed.substring(0, 4), 16) % 1000 + 100;
        const transfer = parseInt(seed.substring(4, 6), 16) % 100 + 10;
        return { question: `رصيدك ${balance}، أرسلت ${transfer}، ما الرصيد الجديد؟`, balance, transfer };
      },
      validate: (answer, data, seed) => {
        const correct = data.balance - data.transfer;
        const userAns = parseInt(answer);
        if (userAns !== correct) return { valid: false, message: `الرصيد الجديد: ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: String(correct).charAt(0) };
      }
    },
    27: {
      type: 'nonce_calculation',
      question: '',
      hint: 'Nonce = number of transactions + 1',
      generate: (seed) => {
        const txCount = parseInt(seed.substring(0, 2), 16) % 10 + 1;
        return { question: `أرسلت ${txCount} معاملات، ما nonce التالي؟`, txCount };
      },
      validate: (answer, data, seed) => {
        const correct = data.txCount + 1;
        const userAns = parseInt(answer);
        if (userAns !== correct) return { valid: false, message: `Nonce = ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: String(correct).charAt(0) };
      }
    },
    28: {
      type: 'eth_address_partial',
      question: '',
      hint: 'ETH address يبدأ بـ 0x',
      generate: (seed) => {
        const prefix = '0x' + seed.substring(0, 8);
        return { question: `ما أول 6 أحرف من ETH address: ${prefix}...?`, prefix };
      },
      validate: (answer, data, seed) => {
        const correct = data.prefix.substring(0, 6);
        if (answer.toLowerCase() !== correct) return { valid: false, message: `أول 6 أحرف: ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + correct).digest('hex').substring(0, 8);
        return { valid: true, nextKey, partialKey: correct.charAt(0) };
      }
    },
    29: {
      type: 'final_challenge',
      question: '🎉 سؤال التحدي الأخير!\n\nاجمع المفاتيح: 1 + 5 + 10 + 15 + 20 + 25؟\n(اكتب الرقم النهائي)',
      hint: 'جمع مفاتيح جزئية = مفتاح نهائي',
      generate: (seed) => ({ seed }),
      validate: (answer, data, seed, history) => {
        const keys = [1, 5, 10, 15, 20, 25].map(i => parseInt(history[i]?.partialKey || '0', 36) || 0);
        const correct = keys.reduce((a, b) => a + b, 0);
        const userAns = parseInt(answer);
        if (userAns !== correct) return { valid: false, message: `المجموع = ${correct}` };
        const nextKey = crypto.createHash('sha256').update(seed + 'FINAL').digest('hex');
        return { valid: true, nextKey, partialKey: '🏆', isFinal: true };
      }
    },
    30: {
      type: 'reward_unlock',
      question: '🎊 تهانينا!\n\nادخل مفتاح المكافأة النهائي:',
      hint: 'المكافأة تنتظرك!',
      generate: (seed) => {
        const rewardKey = crypto.createHash('sha256').update(seed + 'REWARD').digest('hex').substring(0, 12).toUpperCase();
        return { question: `مفتاح المكافأة: ${rewardKey}`, rewardKey };
      },
      validate: (answer, data, seed) => {
        if (answer.toUpperCase() === data.rewardKey) {
          return { valid: true, nextKey: 'COMPLETE', partialKey: '🎉', isReward: true };
        }
        return { valid: false, message: `المفتاح الصحيح: ${data.rewardKey}` };
      }
    }
  };
  return questions[level] || null;
}

module.exports = { generateSeed, generateQuestion, TOTAL_LEVELS: 30 };