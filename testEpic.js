/**
 * Epic Puzzle Test Script
 * Run this to test the 10-stage puzzle system
 */

const { solveEpicPuzzle } = require('./utils/epicPuzzle');

// Test with the example from the user
console.log('='.repeat(60));
console.log('🧪 اختبار نظام الألغاز الملحمية - 10 مراحل');
console.log('='.repeat(60));
console.log('');

// Input values from user
const X1 = 17;
const X2 = 31;
const K = "MATH";
const path = 'A';

console.log(`📥 المدخلات:`);
console.log(`   X1 = ${X1}`);
console.log(`   X2 = ${X2}`);
console.log(`   K = "${K}"`);
console.log(`   Path = ${path}`);
console.log('');

// Solve the puzzle
const result = solveEpicPuzzle(X1, X2, K, path);

console.log('');
console.log('='.repeat(60));
console.log('📊 ملخص المراحل:');
console.log('='.repeat(60));

const stages = result.stages;

console.log(`
📍 المرحلة 1 - البداية:`);
console.log(`   مفاتيح SHA256 الأولية تم توليدها`);

console.log(`
📍 المرحلة 2 - السلسلة المشفرة:`);
console.log(`   طول السلسلة: ${stages.s2.chain.length} حرف`);

console.log(`
📍 المرحلة 3 - XOR:`);
console.log(`   P1² = ${stages.s3.p1Squared}`);

console.log(`
📍 المرحلة 4 - السلسلة الرياضية:`);
console.log(`   S0 = ${stages.s4.s0}`);
console.log(`   عدد العناصر: ${stages.s4.length}`);

console.log(`
📍 المرحلة 5 - تحويل لأحرف:`);
console.log(`   الأحرف: ${stages.s5.charString}`);

console.log(`
📍 المرحلة 6 - المسار ${path}:`);
console.log(`   الأصلي: ${stages.s6.original}`);
console.log(`   المشفر: ${stages.s6.modified}`);

console.log(`
📍 المرحلة 7 - التكرار:`);
console.log(`   التكرارات: ${stages.s7.iterations}`);

console.log(`
📍 المرحلة 8 - الرموز:`);
console.log(`   طول السلسلة: ${stages.s8.length}`);

console.log(`
📍 المرحلة 9 - البناء التدريجي:`);
console.log(`   عدد الأجزاء: ${stages.s9.totalParts}`);

console.log(`
📍 المرحلة 10 - النص النهائي:`);
console.log(`   ✅ النتيجة: ${result.finalText}`);
console.log(`   📧 بريد إلكتروني: ${result.isEmail ? 'نعم ✓' : 'لا'}`);

console.log('');
console.log('='.repeat(60));
console.log('🏁 اكتمل الاختبار بنجاح!');
console.log('='.repeat(60));
