const crypto = require('crypto');

/**
 * ═══════════════════════════════════════════════════════
 *  نظام الألغاز الجديد - 30 سؤال + تحقق + ترابط
 * ═══════════════════════════════════════════════════════
 * 
 * المستوى الأول (1-10): أسئلة سهلة - شخصية وثقافية
 * المستوى الثاني (11-20): أسئلة متوسطة - رياضيات وتشفير
 * المستوى الثالث (21-30): أسئلة صعبة - عشوائية وبلوكتشين
 * 
 * كل سؤال يعتمد على الإجابات السابقة!
 * رسالة الفوز تُبنى من جميع الإجابات
 */

const puzzles = {
  // ═══════════════════════════════════════════════════════
  // المستوى الأول (1-10): أسئلة سهلة - شخصية وثقافية
  // ═══════════════════════════════════════════════════════
  
  'PZ_01': {
    level: 1,
    difficulty: 'easy',
    type: 'personal',
    category: 'identity',
    question: 'ما هو اسمك الأول؟ (بالإنجليزية، حروف فقط)',
    hint: 'Your first name in English letters only',
    validation: {
      type: 'regex',
      pattern: '^[A-Za-z]{2,10}$',
      error: 'أدخل اسمك بالإنجليزية (2-10 أحرف)'
    },
    storage_key: 'user_name',
    chain_output: 'first_letter',
    points: 10
  },

  'PZ_02': {
    level: 2,
    difficulty: 'easy',
    type: 'personal',
    category: 'birth',
    question: 'في أي شهر ولدت؟ (أدخل رقم الشهر: 1-12)',
    hint: 'January=1, December=12',
    validation: {
      type: 'range',
      min: 1,
      max: 12,
      error: 'أدخل رقم شهر صحيح (1-12)'
    },
    storage_key: 'birth_month',
    chain_output: 'month_mod12',
    points: 10,
    depends_on: ['PZ_01']
  },

  'PZ_03': {
    level: 3,
    difficulty: 'easy',
    type: 'cultural',
    category: 'country',
    question: 'ما هي دولتك؟ (أدخل اسم الدولة بالإنجليزية)',
    hint: 'Your country name in English',
    validation: {
      type: 'enum',
      allowed: ['egypt', 'saudi', 'uae', 'qatar', 'kuwait', 'bahrain', 'oman', 'jordan', 'lebanon', 'iraq', 'morocco', 'algeria', 'tunisia', 'libya', 'syria', 'palestine', 'yemen', 'sudan', 'usa', 'uk', 'germany', 'france', 'italy', 'spain', 'turkey', 'russia', 'china', 'japan', 'india', 'brazil', 'argentina', 'canada', 'australia'],
      error: 'أدخل اسم دولة صحيح'
    },
    storage_key: 'country',
    chain_output: 'country_code',
    points: 10,
    depends_on: ['PZ_02']
  },

  'PZ_04': {
    level: 4,
    difficulty: 'easy',
    type: 'cultural',
    category: 'language',
    question: 'ما هي لغتك الأم؟ (أدخل رمز اللغة: ar/en/fr/es/tr)',
    hint: 'Arabic=ar, English=en, French=fr, Spanish=es, Turkish=tr',
    validation: {
      type: 'enum',
      allowed: ['ar', 'en', 'fr', 'es', 'tr', 'de', 'it', 'ru', 'zh', 'ja'],
      error: 'أدخل رمز لغة صحيح'
    },
    storage_key: 'native_language',
    chain_output: 'lang_number',
    points: 10,
    depends_on: ['PZ_03']
  },

  'PZ_05': {
    level: 5,
    difficulty: 'easy',
    type: 'knowledge',
    category: 'education',
    question: 'ما هو تخصصك أو مجال دراستك؟ (أدخل مجال واحد: it/medical/engineering/business/arts/law/education/none)',
    hint: 'IT, Medical, Engineering, Business, Arts, Law, Education, None',
    validation: {
      type: 'enum',
      allowed: ['it', 'medical', 'engineering', 'business', 'arts', 'law', 'education', 'science', 'none', 'other'],
      error: 'أدخل مجال دراسي صحيح'
    },
    storage_key: 'field_of_study',
    chain_output: 'field_hash',
    points: 10,
    depends_on: ['PZ_04']
  },

  'PZ_06': {
    level: 6,
    difficulty: 'easy',
    type: 'preference',
    category: 'color',
    question: 'ما هو لونك المفضل؟ (أدخل بالإنجليزية)',
    hint: 'Red, Blue, Green, Black, White, Yellow, Orange, Purple, Pink, Brown',
    validation: {
      type: 'enum',
      allowed: ['red', 'blue', 'green', 'black', 'white', 'yellow', 'orange', 'purple', 'pink', 'brown', 'gray', 'gold', 'silver'],
      error: 'أدخل لون صحيح'
    },
    storage_key: 'favorite_color',
    chain_output: 'color_rgb',
    points: 10,
    depends_on: ['PZ_05']
  },

  'PZ_07': {
    level: 7,
    difficulty: 'easy',
    type: 'lifestyle',
    category: 'time',
    question: 'في أي ساعة تستيقظ عادة؟ (أدخل ساعة من 0-23)',
    hint: '0=Midnight, 12=Noon, 23=11PM',
    validation: {
      type: 'range',
      min: 0,
      max: 23,
      error: 'أدخل ساعة صحيحة (0-23)'
    },
    storage_key: 'wake_up_time',
    chain_output: 'time_period',
    points: 10,
    depends_on: ['PZ_06']
  },

  'PZ_08': {
    level: 8,
    difficulty: 'easy',
    type: 'preference',
    category: 'food',
    question: 'ما هو طعامك المفضل؟ (أدخل: pizza/burger/sushi/kebab/falafel/pasta/rice/chicken/meat/vegetarian)',
    hint: 'اختر من القائمة',
    validation: {
      type: 'enum',
      allowed: ['pizza', 'burger', 'sushi', 'kebab', 'falafel', 'pasta', 'rice', 'chicken', 'meat', 'vegetarian', 'seafood', 'salad', 'soup'],
      error: 'أدخل طعام صحيح من القائمة'
    },
    storage_key: 'favorite_food',
    chain_output: 'food_calories',
    points: 10,
    depends_on: ['PZ_07']
  },

  'PZ_09': {
    level: 9,
    difficulty: 'easy',
    type: 'hobby',
    category: 'activity',
    question: 'ما هو هوايتك الرئيسية؟ (أدخل: gaming/reading/sports/music/travel/cooking/art/coding/photography/none)',
    hint: 'اختر من القائمة',
    validation: {
      type: 'enum',
      allowed: ['gaming', 'reading', 'sports', 'music', 'travel', 'cooking', 'art', 'coding', 'photography', 'writing', 'dancing', 'none'],
      error: 'أدخل هواية صحيحة'
    },
    storage_key: 'hobby',
    chain_output: 'hobby_score',
    points: 10,
    depends_on: ['PZ_08']
  },

  'PZ_10': {
    level: 10,
    difficulty: 'easy',
    type: 'password',
    category: 'security',
    question: 'أنشئ كلمة سر خاصة بك للمشروع (8-16 حرف، حروف وأرقام)',
    hint: 'كلمة سر قوية، ستُستخدم في الأسئلة القادمة',
    validation: {
      type: 'regex',
      pattern: '^[A-Za-z0-9]{8,16}$',
      error: 'كلمة سر 8-16 حرف وأرقام فقط'
    },
    storage_key: 'user_password',
    chain_output: 'password_hash',
    points: 20,
    depends_on: ['PZ_09'],
    is_chain_starter: true
  },

  // ═══════════════════════════════════════════════════════
  // المستوى الثاني (11-20): أسئلة متوسطة - رياضيات وتشفير
  // ═══════════════════════════════════════════════════════

  'PZ_11': {
    level: 11,
    difficulty: 'medium',
    type: 'math',
    category: 'functions',
    question: 'سؤال 11: خذ الحرف الأول من كلمة السر (سؤال 10) وأوجد ASCII code له، ثم أضف رقم شهر ميلادك (سؤال 2)، ما الناتج؟',
    hint: 'ASCII: A=65, B=66... a=97, b=98... مثال: إذا كان الحرف A وشهرك 3 → 65+3=68',
    validation: {
      type: 'custom',
      error: 'أدخل الناتج الصحيح'
    },
    storage_key: 'math_1',
    chain_output: 'math_result_1',
    points: 30,
    depends_on: ['PZ_10', 'PZ_02'],
    requires_chain: true
  },

  'PZ_12': {
    level: 12,
    difficulty: 'medium',
    type: 'math',
    category: 'inverse_function',
    question: 'سؤال 12: خذ ناتج السؤال السابق ({prev_answer}) وأضربه في 3، ثم اطرح 7. ما الناتج؟',
    hint: 'الناتج = (سؤال 11 × 3) - 7',
    validation: {
      type: 'custom',
      error: 'أدخل الناتج الصحيح'
    },
    storage_key: 'math_2',
    chain_output: 'math_result_2',
    points: 30,
    depends_on: ['PZ_11'],
    requires_chain: true
  },

  'PZ_13': {
    level: 13,
    difficulty: 'medium',
    type: 'encryption',
    category: 'caesar',
    question: 'سؤال 13: شفر كلمة "HELLO" باستخدام Caesar cipher مع مفتاح = ناتج السؤال السابق (mod 26)',
    hint: 'كل حرف يتحرك للخلف بقيمة المفتاح. مثال: A + 3 = D',
    validation: {
      type: 'custom',
      error: 'أدخل الكلمة المشفرة'
    },
    storage_key: 'cipher_1',
    chain_output: 'cipher_text_1',
    points: 30,
    depends_on: ['PZ_12'],
    requires_chain: true
  },

  'PZ_14': {
    level: 14,
    difficulty: 'medium',
    type: 'math',
    category: 'prime',
    question: 'سؤال 14: ما هو أكبر عدد أولي أصغر من 100؟',
    hint: 'الأعداد الأولية: 2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97',
    validation: {
      type: 'enum',
      allowed: ['97'],
      error: 'أدخل العدد الصحيح'
    },
    storage_key: 'prime_number',
    chain_output: 'prime_squared',
    points: 30,
    depends_on: ['PZ_13']
  },

  'PZ_15': {
    level: 15,
    difficulty: 'medium',
    type: 'math',
    category: 'fibonacci',
    question: 'سؤال 15: ما هو رقم Fibonacci التالي في المتسلسلة: 1, 1, 2, 3, 5, 8, 13, 21, ?',
    hint: 'كل رقم = مجموع الرقمين السابقين',
    validation: {
      type: 'enum',
      allowed: ['34', '34'],
      error: 'أدخل الرقم الصحيح'
    },
    storage_key: 'fibonacci',
    chain_output: 'fib_mod',
    points: 30,
    depends_on: ['PZ_14']
  },

  'PZ_16': {
    level: 16,
    difficulty: 'medium',
    type: 'encryption',
    category: 'base64',
    question: 'سؤال 16: شفر كلمة "CRYPTO" إلى Base64',
    hint: 'استخدم أي Base64 encoder',
    validation: {
      type: 'enum',
      allowed: ['Q1JZUFRP', 'Q1JZUFRP'],
      error: 'أدخل Base64 الصحيح'
    },
    storage_key: 'base64_1',
    chain_output: 'base64_length',
    points: 30,
    depends_on: ['PZ_15']
  },

  'PZ_17': {
    level: 17,
    difficulty: 'medium',
    type: 'math',
    category: 'binary',
    question: 'سؤال 17: حوّل الرقم 255 إلى نظام ثنائي (Binary)',
    hint: '2^7=128, 2^6=64, 2^5=32, 2^4=16, 2^3=8, 2^2=4, 2^1=2, 2^0=1',
    validation: {
      type: 'enum',
      allowed: ['11111111', '0b11111111'],
      error: 'أدخل الرقم الثنائي الصحيح'
    },
    storage_key: 'binary_1',
    chain_output: 'binary_sum',
    points: 30,
    depends_on: ['PZ_16']
  },

  'PZ_18': {
    level: 18,
    difficulty: 'medium',
    type: 'math',
    category: 'hex',
    question: 'سؤال 18: حوّل الرقم 255 إلى نظام Hexadecimal',
    hint: '10=A, 11=B, ... 15=F',
    validation: {
      type: 'enum',
      allowed: ['FF', '0xFF', 'ff'],
      error: 'أدخل الـ Hex الصحيح'
    },
    storage_key: 'hex_1',
    chain_output: 'hex_value',
    points: 30,
    depends_on: ['PZ_17']
  },

  'PZ_19': {
    level: 19,
    difficulty: 'medium',
    type: 'encryption',
    category: 'reverse',
    question: 'سؤال 19: اكتب كلمة "PUZZLE" بالعكس',
    hint: 'اقلب الحروف',
    validation: {
      type: 'enum',
      allowed: ['ELZZUP', 'elzzup'],
      error: 'أدخل الكلمة المعكوسة'
    },
    storage_key: 'reverse_1',
    chain_output: 'reverse_hash',
    points: 30,
    depends_on: ['PZ_18']
  },

  'PZ_20': {
    level: 20,
    difficulty: 'medium',
    type: 'math',
    category: 'modular',
    question: 'سؤال 20: ما هو ناتج: (17 × 23) mod 10؟',
    hint: 'اضرب ثم خذ الباقي منقسمة على 10',
    validation: {
      type: 'enum',
      allowed: ['1', '01'],
      error: 'أدخل الناتج الصحيح'
    },
    storage_key: 'modular_1',
    chain_output: 'modular_result',
    points: 40,
    depends_on: ['PZ_19'],
    is_milestone: true
  },

  // ═══════════════════════════════════════════════════════
  // المستوى الثالث (21-30): أسئلة صعبة - عشوائية وبلوكتشين
  // ═══════════════════════════════════════════════════════

  'PZ_21': {
    level: 21,
    difficulty: 'hard',
    type: 'blockchain',
    category: 'hash',
    question: 'سؤال 21: ما هو SHA-256 للرقم "1"؟ (أول 8 أحرف فقط)',
    hint: 'استخدم أي SHA256 calculator',
    validation: {
      type: 'enum',
      allowed: ['6b86b273', '6B86B273'],
      error: 'أدخل أول 8 أحرف من الـ Hash'
    },
    storage_key: 'sha256_1',
    chain_output: 'sha_first_char',
    points: 50,
    depends_on: ['PZ_20']
  },

  'PZ_22': {
    level: 22,
    difficulty: 'hard',
    type: 'random',
    category: 'uuid',
    question: 'سؤال 22: ما هو أول 8 أحرف من UUID v4؟',
    hint: 'UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
    validation: {
      type: 'regex',
      pattern: '^[0-9a-fA-F]{8}$',
      error: 'أدخل 8 أحرف hex صحيحة'
    },
    storage_key: 'uuid_1',
    chain_output: 'uuid_number',
    points: 50,
    depends_on: ['PZ_21']
  },

  'PZ_23': {
    level: 23,
    difficulty: 'hard',
    type: 'blockchain',
    category: 'merkle',
    question: 'سؤال 23: في شجرة Merkle، إذا كانت الأوراق هي ["A", "B", "C", "D"]، كم عدد الـ Hashات الإجمالي؟',
    hint: 'شجرة Merkle تبني من الأسفل للأعلى',
    validation: {
      type: 'enum',
      allowed: ['7', 'seven'],
      error: 'أدخل العدد الصحيح'
    },
    storage_key: 'merkle_1',
    chain_output: 'merkle_count',
    points: 50,
    depends_on: ['PZ_22']
  },

  'PZ_24': {
    level: 24,
    difficulty: 'hard',
    type: 'crypto',
    category: 'signature',
    question: 'سؤال 24: ما نوع التوقيع الرقمي المستخدم في Bitcoin؟',
    hint: 'ECDSA',
    validation: {
      type: 'enum',
      allowed: ['ecdsa', 'ECDSA', 'Elliptic Curve Digital Signature Algorithm'],
      error: 'أدخل نوع التوقيع الصحيح'
    },
    storage_key: 'signature_1',
    chain_output: 'signature_curve',
    points: 50,
    depends_on: ['PZ_23']
  },

  'PZ_25': {
    level: 25,
    difficulty: 'hard',
    type: 'blockchain',
    category: 'consensus',
    question: 'سؤال 25: ما خوارزمية Consensus المستخدمة في Ethereum حالياً؟',
    hint: 'PoS = Proof of Stake',
    validation: {
      type: 'enum',
      allowed: ['pos', 'PoS', 'proof of stake', 'Proof of Stake'],
      error: 'أدخل خوارزمية Consensus الصحيحة'
    },
    storage_key: 'consensus_1',
    chain_output: 'consensus_type',
    points: 50,
    depends_on: ['PZ_24']
  },

  'PZ_26': {
    level: 26,
    difficulty: 'hard',
    type: 'math',
    category: 'complex',
    question: 'سؤال 26: ما هو ناتج: i^2 + i^4 + i^6؟ (i = الجذر التربيعي لـ -1)',
    hint: 'i² = -1, i⁴ = 1, i⁶ = -1',
    validation: {
      type: 'enum',
      allowed: ['-2', '-2', 'سالب اثنين'],
      error: 'أدخل الناتج الصحيح'
    },
    storage_key: 'complex_1',
    chain_output: 'complex_result',
    points: 50,
    depends_on: ['PZ_25']
  },

  'PZ_27': {
    level: 27,
    difficulty: 'hard',
    type: 'encryption',
    category: 'aes',
    question: 'سؤال 27: ما هو حجم مفتاح AES-256؟ (بـ bits)',
    hint: '256',
    validation: {
      type: 'enum',
      allowed: ['256', '256bit', '256 bits'],
      error: 'أدخل الحجم الصحيح'
    },
    storage_key: 'aes_1',
    chain_output: 'aes_key_size',
    points: 50,
    depends_on: ['PZ_26']
  },

  'PZ_28': {
    level: 28,
    difficulty: 'hard',
    type: 'blockchain',
    category: 'token',
    question: 'سؤال 28: ما معيار Token الـ ERC-20؟',
    hint: 'Ethereum Request for Comments',
    validation: {
      type: 'enum',
      allowed: ['erc20', 'ERC20', 'erc-20', 'ERC-20'],
      error: 'أدخل معيار الـ Token الصحيح'
    },
    storage_key: 'erc20_1',
    chain_output: 'erc_standard',
    points: 50,
    depends_on: ['PZ_27']
  },

  'PZ_29': {
    level: 29,
    difficulty: 'hard',
    type: 'random',
    category: 'lottery',
    question: 'سؤال 29: أدخل أي رقم من 1 إلى 1000 (سيتم التحقق عشوائياً)',
    hint: 'أدخل رقم عشوائي',
    validation: {
      type: 'range',
      min: 1,
      max: 1000,
      error: 'أدخل رقم من 1 إلى 1000'
    },
    storage_key: 'random_1',
    chain_output: 'random_seed',
    points: 50,
    depends_on: ['PZ_28']
  },

  // ═══════════════════════════════════════════════════════
  // السؤال الأخير (30): التجميع النهائي
  // ═══════════════════════════════════════════════════════

  'PZ_30': {
    level: 30,
    difficulty: 'final',
    type: 'accumulation',
    category: 'final',
    question: '🎯 السؤال الأخير!\n\nاجمع كل إجاباتك السابقة في جملة واحدة:\n1. خذ أول حرف من إجابة سؤال 1\n2. أضف رقم سؤال 2\n3. أضف أول 3 أحرف من إجابة سؤال 3\n4. أضف إجابة سؤال 10 (كلمة السر)\n5. أضف ناتج سؤال 11\n6. أضف ناتج سؤال 20\n7. أضف إجابة سؤال 29\n8. أضف "MRABT" في النهاية\n\nأرسل الجملة النهائية',
    hint: 'مثال: J3EGYpass12345...MRABT',
    validation: {
      type: 'custom',
      error: 'أدخل الجملة النهائية'
    },
    storage_key: 'final_answer',
    chain_output: 'final_message',
    points: 100,
    depends_on: ['PZ_01', 'PZ_02', 'PZ_03', 'PZ_10', 'PZ_11', 'PZ_20', 'PZ_29'],
    is_final: true
  }
};

// ═══════════════════════════════════════════════════════
// دوال التحقق من الإجابات
// ═══════════════════════════════════════════════════════

function validateAnswer(puzzle, answer, userPuzzles) {
  const validation = puzzle.validation;
  const normalizedAnswer = String(answer).trim().toLowerCase();
  
  switch (validation.type) {
    case 'regex':
      const regex = new RegExp(validation.pattern, 'i');
      return regex.test(answer);
    
    case 'range':
      const numAnswer = parseInt(answer);
      return numAnswer >= validation.min && numAnswer <= validation.max;
    
    case 'enum':
      return validation.allowed.some(a => 
        String(a).toLowerCase() === normalizedAnswer
      );
    
    case 'custom':
      return validateCustomAnswer(puzzle, answer, userPuzzles);
    
    default:
      return false;
  }
}

function validateCustomAnswer(puzzle, answer, userPuzzles) {
  const prevAnswers = {};
  userPuzzles.forEach(p => {
    if (p.completed && p.user_answer) {
      prevAnswers[p.storage_key] = p.user_answer;
    }
  });
  
  // السؤال 11
  if (puzzle.storage_key === 'math_1') {
    const pwd = prevAnswers['user_password'];
    const month = prevAnswers['birth_month'];
    if (pwd && month) {
      const firstChar = pwd.charAt(0).toUpperCase();
      const ascii = firstChar.charCodeAt(0);
      const expected = ascii + parseInt(month);
      return parseInt(answer) === expected;
    }
  }
  
  // السؤال 12
  if (puzzle.storage_key === 'math_2') {
    const prev = prevAnswers['math_1'];
    if (prev) {
      const expected = (parseInt(prev) * 3) - 7;
      return parseInt(answer) === expected;
    }
  }
  
  // السؤال 13
  if (puzzle.storage_key === 'cipher_1') {
    const prev = prevAnswers['math_2'];
    if (prev) {
      const key = parseInt(prev) % 26;
      const word = 'HELLO';
      let result = '';
      for (let i = 0; i < word.length; i++) {
        let charCode = word.charCodeAt(i) - 65;
        charCode = (charCode - key + 26) % 26;
        result += String.fromCharCode(charCode + 65);
      }
      return result.toUpperCase() === answer.toUpperCase();
    }
  }
  
  // السؤال 30
  if (puzzle.is_final) {
    const required = ['user_name', 'birth_month', 'country', 'user_password', 'math_1', 'modular_1', 'random_1'];
    for (let key of required) {
      if (!prevAnswers[key]) return false;
    }
    return answer.toUpperCase().includes('MRABT');
  }
  
  return true;
}

// ═══════════════════════════════════════════════════════
// بناء رسالة الفوز النهائية
// ═══════════════════════════════════════════════════════

function buildFinalMessage(userPuzzles) {
  const answers = {};
  userPuzzles.forEach(p => {
    if (p.completed && p.user_answer) {
      answers[p.storage_key] = p.user_answer;
    }
  });
  
  const name = answers['user_name'] || '';
  const month = answers['birth_month'] || '';
  const country = answers['country'] || '';
  const pwd = answers['user_password'] || '';
  const math1 = answers['math_1'] || '';
  const math2 = answers['math_2'] || '';
  const final = answers['random_1'] || '';
  
  const finalMessage = 
    name.substring(0, 1).toUpperCase() + 
    month + 
    country.substring(0, 3).toUpperCase() + 
    pwd + 
    math1 + 
    math2 + 
    final + 
    'MRABT';
  
  return finalMessage;
}

// ═══════════════════════════════════════════════════════
// توليد الألغاز لكل مستخدم
// ═══════════════════════════════════════════════════════

function generateUserPuzzles(userId) {
  const userHash = crypto.createHash('sha256').update(userId).digest('hex');
  const userNum = parseInt(userHash.substring(0, 8), 16);
  
  const userPuzzles = [];
  const puzzleKeys = Object.keys(puzzles).sort((a, b) => 
    puzzles[a].level - puzzles[b].level
  );
  
  puzzleKeys.forEach((key, index) => {
    const puzzle = puzzles[key];
    userPuzzles.push({
      id: key,
      level: puzzle.level,
      difficulty: puzzle.difficulty,
      type: puzzle.type,
      category: puzzle.category,
      question: puzzle.question,
      hint: puzzle.hint,
      storage_key: puzzle.storage_key,
      chain_output: puzzle.chain_output,
      points: puzzle.points,
      depends_on: puzzle.depends_on || [],
      requires_chain: puzzle.requires_chain || false,
      is_chain_starter: puzzle.is_chain_starter || false,
      is_milestone: puzzle.is_milestone || false,
      is_final: puzzle.is_final || false,
      validation_type: puzzle.validation.type,
      status: index === 0 ? 'active' : 'locked',
      user_answer: null,
      user_answers: [],
      completed: false,
      attempts: 0,
      max_attempts: 3
    });
  });
  
  return userPuzzles;
}

// ═══════════════════════════════════════════════════════
// التحقق من إمكانية فتح السؤال التالي
// ═══════════════════════════════════════════════════════

function canUnlockNext(currentPuzzle, userPuzzles) {
  if (!currentPuzzle.depends_on || currentPuzzle.depends_on.length === 0) {
    return true;
  }
  
  for (let depId of currentPuzzle.depends_on) {
    const depPuzzle = userPuzzles.find(p => p.id === depId);
    if (!depPuzzle || !depPuzzle.completed) {
      return false;
    }
  }
  
  return true;
}

module.exports = { 
  puzzles, 
  generateUserPuzzles, 
  validateAnswer, 
  buildFinalMessage,
  canUnlockNext
};