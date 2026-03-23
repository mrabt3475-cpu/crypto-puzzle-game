/**
 * Epic Crypto Puzzle - 10-Stage System
 * Each stage builds on the previous one
 */

const crypto = require('crypto');

// Prime numbers for operations
const PRIMES = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
  73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173,
  179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281
];

// Stage 1: Initialize Keys
function stage1_initKeys(x1, x2, k) {
  const keys = {
    x1, x2, k,
    primaryKeys: {
      key1: crypto.createHash('sha256').update(k + x1).digest('hex'),
      key2: crypto.createHash('sha256').update(k + x2).digest('hex'),
      keyCombined: crypto.createHash('sha256').update(k + x1 + x2).digest('hex')
    },
    stage: 1
  };
  return keys;
}

// Stage 2: Generate Encrypted Chain
function stage2_generateChain(keys) {
  const hash1 = crypto.createHash('sha256').update(keys.k + keys.x1).digest('hex');
  const hash2 = crypto.createHash('sha256').update(keys.k + keys.x2).digest('hex');
  
  // Convert hex to decimal string (10-15 digits)
  const decimal1 = parseInt(hash1.substring(0, 8), 16);
  const decimal2 = parseInt(hash2.substring(0, 8), 16);
  
  // Generate 10-15 digit chain
  let chain = '';
  for (let i = 0; i < 12; i++) {
    const num = (decimal1 * (i + 1) + decimal2) % 1000000000000;
    chain += num.toString().padStart(12, '0');
  }
  
  return {
    chain: chain.substring(0, 150),
    hash1, hash2,
    decimal1, decimal2,
    stage: 2
  };
}

// Stage 3: XOR with Prime Squares
function stage3_xorWithPrimes(chainData, p1 = 7) {
  const p1Squared = p1 * p1; // 49
  let encryptedChain = '';
  
  for (let char of chainData.chain) {
    if (char >= '0' && char <= '9') {
      const num = parseInt(char);
      const encrypted = num ^ (p1Squared % 10);
      encryptedChain += encrypted.toString();
    } else {
      encryptedChain += char;
    }
  }
  
  return {
    originalChain: chainData.chain,
    encryptedChain,
    p1,
    p1Squared,
    stage: 3
  };
}

// Stage 4: Mathematical Series
function stage4_mathSeries(x1, x2, chainData) {
  const s0 = x1 + x2; // 48
  const series = [s0];
  const hashes = [chainData.hash1, chainData.hash2];
  
  // Generate 50-100 elements
  const numElements = 50 + (x1 % 51); // 50-100
  
  for (let n = 1; n < numElements; n++) {
    const prevS = series[n - 1];
    const prevHash = hashes[n % 2];
    const hashNum = parseInt(prevHash.substring(n * 2, n * 2 + 4), 16) % 10000;
    const primeSquared = (PRIMES[n % PRIMES.length] || 2) ** 2;
    
    const sn = (Math.pow(prevS, 3) + Math.pow(hashNum, 5) + primeSquared) % 9973;
    series.push(sn);
  }
  
  return {
    s0,
    series,
    length: series.length,
    stage: 4
  };
}

// Stage 5: Convert to Characters
function stage5_toChars(seriesData) {
  let chars = [];
  
  for (let i = 0; i < Math.min(10, seriesData.series.length); i++) {
    const num = seriesData.series[i];
    const charCode = (num % 26) + 65; // A-Z
    chars.push(String.fromCharCode(charCode));
  }
  
  return {
    chars,
    charString: chars.join(', '),
    stage: 5
  };
}

// Stage 6: Conditional Paths
function stage6_conditionalPath(charsData, path = 'A') {
  let modifiedChars = [...charsData.chars];
  const pathResults = {
    path,
    operations: []
  };
  
  switch (path) {
    case 'A': // XOR additional
      modifiedChars = modifiedChars.map((c, i) => {
        const xorVal = (7 * (i + 1)) % 26;
        const code = ((c.charCodeAt(0) - 65) ^ xorVal + 26) % 26 + 65;
        return String.fromCharCode(code);
      });
      pathResults.operations.push('XOR applied');
      break;
      
    case 'B': // Caesar Shift
      modifiedChars = modifiedChars.map((c, i) => {
        const shift = (3 * (i + 1)) % 26;
        const code = ((c.charCodeAt(0) - 65 + shift) % 26) + 65;
        return String.fromCharCode(code);
      });
      pathResults.operations.push('Caesar shift applied');
      break;
      
    case 'C': // Merge Hash
      const hash = crypto.createHash('sha256').update(modifiedChars.join('')).digest('hex');
      modifiedChars = modifiedChars.map((c, i) => {
        const hashVal = parseInt(hash.substring(i * 2, i * 2 + 2), 16) % 26;
        const code = ((c.charCodeAt(0) - 65 + hashVal) % 26) + 65;
        return String.fromCharCode(code);
      });
      pathResults.operations.push('Hash merge applied');
      break;
      
    case 'D': // Reverse
      modifiedChars = modifiedChars.reverse();
      pathResults.operations.push('Reversed');
      break;
  }
  
  return {
    original: charsData.chars.join(''),
    modified: modifiedChars.join(''),
    path,
    operations: pathResults.operations,
    stage: 6
  };
}

// Stage 7: Partial Repetition (200-500 iterations)
function stage7_repetition(pathData, r1 = 23, r2 = 47, r3 = 59) {
  const rValues = [r1, r2, r3];
  let series = pathData.modified.split('').map(c => c.charCodeAt(0));
  const iterations = 200 + (r1 % 301); // 200-500
  
  for (let i = 0; i < iterations; i++) {
    const r = rValues[i % 3];
    const rCubed = Math.pow(r, 3);
    const hashVal = parseInt(crypto.createHash('sha256').update(i.toString()).digest('hex').substring(0, 8), 16);
    
    series = series.map((val, idx) => {
      return (val + rCubed + hashVal) % 104729;
    });
  }
  
  return {
    originalLength: pathData.modified.length,
    finalLength: series.length,
    iterations,
    r1, r2, r3,
    seriesSample: series.slice(0, 10),
    stage: 7
  };
}

// Stage 8: Extract Symbols
function stage8_extractSymbols(repData) {
  let symbols = '';
  
  for (let i = 0; i < Math.min(100, repData.seriesSample.length); i++) {
    const charCode = (repData.seriesSample[i % repData.seriesSample.length] % 26) + 65;
    symbols += String.fromCharCode(charCode);
  }
  
  // Ensure 100-200 characters
  while (symbols.length < 100) {
    symbols += symbols;
  }
  
  return {
    symbols: symbols.substring(0, 150),
    length: symbols.length,
    stage: 8
  };
}

// Stage 9: Gradual Text Building
function stage9_gradualBuild(symbolsData, pathData) {
  const messages = [];
  const symbols = symbolsData.symbols;
  
  // Split into 20-char parts
  const partLength = 20;
  for (let i = 0; i < symbols.length; i += partLength) {
    let part = symbols.substring(i, i + partLength);
    
    // Caesar Shift + XOR with hash from stage 6
    const hashVal = parseInt(crypto.createHash('sha256').update(pathData.modified).digest('hex').substring(0, 8), 16);
    
    let decoded = '';
    for (let j = 0; j < part.length; j++) {
      const charCode = part.charCodeAt(j);
      if (charCode >= 65 && charCode <= 90) {
        // Caesar shift back
        let shifted = ((charCode - 65 - 3 + 26) % 26) + 65;
        // XOR with hash
        const xorVal = (hashVal >> (j * 2)) & 0x1F;
        shifted = ((shifted - 65) ^ xorVal + 26) % 26 + 65;
        decoded += String.fromCharCode(shifted);
      } else {
        decoded += part[j];
      }
    }
    
    messages.push({
      part: i / partLength + 1,
      encrypted: part,
      decoded: decoded
    });
  }
  
  return {
    messages,
    totalParts: messages.length,
    stage: 9
  };
}

// Stage 10: Final Text
function stage10_finalText(messagesData) {
  let finalText = '';
  
  for (const msg of messagesData.messages) {
    finalText += msg.decoded;
  }
  
  // Clean up and format
  finalText = finalText.replace(/[^a-zA-Z0-9@.]/g, '');
  
  return {
    finalText,
    length: finalText.length,
    isEmail: finalText.includes('@'),
    stage: 10
  };
}

// Main function to run all stages
function solveEpicPuzzle(x1, x2, k, path = 'A') {
  console.log('🚀 Starting Epic Puzzle Solution...');
  console.log(`📥 Input: X1=${x1}, X2=${x2}, K="${k}"`);
  console.log('');
  
  // Stage 1
  const s1 = stage1_initKeys(x1, x2, k);
  console.log('📍 Stage 1: Initialize Keys');
  console.log(`   Primary Keys Generated: ${s1.primaryKeys.key1.substring(0, 16)}...`);
  
  // Stage 2
  const s2 = stage2_generateChain(s1);
  console.log('📍 Stage 2: Generate Encrypted Chain');
  console.log(`   Chain Length: ${s2.chain.length} chars`);
  
  // Stage 3
  const s3 = stage3_xorWithPrimes(s2);
  console.log('📍 Stage 3: XOR with Prime Squares');
  console.log(`   P1² = ${s3.p1Squared}`);
  
  // Stage 4
  const s4 = stage4_mathSeries(x1, x2, s2);
  console.log('📍 Stage 4: Mathematical Series');
  console.log(`   S0 = ${s4.s0}, Elements = ${s4.length}`);
  
  // Stage 5
  const s5 = stage5_toChars(s4);
  console.log('📍 Stage 5: Convert to Characters');
  console.log(`   Chars: ${s5.charString}`);
  
  // Stage 6
  const s6 = stage6_conditionalPath(s5, path);
  console.log(`📍 Stage 6: Conditional Path [${path}]`);
  console.log(`   Original: ${s6.original}`);
  console.log(`   Modified: ${s6.modified}`);
  
  // Stage 7
  const s7 = stage7_repetition(s6);
  console.log('📍 Stage 7: Partial Repetition');
  console.log(`   Iterations: ${s7.iterations}`);
  
  // Stage 8
  const s8 = stage8_extractSymbols(s7);
  console.log('📍 Stage 8: Extract Symbols');
  console.log(`   Symbols Length: ${s8.length}`);
  
  // Stage 9
  const s9 = stage9_gradualBuild(s8, s6);
  console.log('📍 Stage 9: Gradual Text Building');
  console.log(`   Parts: ${s9.totalParts}`);
  
  // Stage 10
  const s10 = stage10_finalText(s9);
  console.log('📍 Stage 10: Final Text');
  console.log(`   Result: ${s10.finalText}`);
  console.log('');
  console.log('✅ Puzzle Solved!');
  
  return {
    stages: { s1, s2, s3, s4, s5, s6, s7, s8, s9, s10 },
    finalText: s10.finalText,
    isEmail: s10.isEmail
  };
}

// Export for use in routes
module.exports = {
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
};
