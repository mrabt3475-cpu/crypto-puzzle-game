const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { generateUserPuzzles } = require('../config/puzzles_new');
const User = require('../models/User');

// ═══════════════════════════════════════════════════════
// نظام الألغاز الجديد - مسار واحد + تراكم + محاولات محدودة
// ═══════════════════════════════════════════════════════

// GET /current - جلب اللغز الحالي
router.get('/current', auth, async (req, res) => {
  try {
    const user = req.user;
    
    // تهيئة الألغاز إذا لم تكن موجودة
    if (!user.puzzles || user.puzzles.length === 0) {
      user.puzzles = generateUserPuzzles(user._id.toString());
      user.freeCredits = 10; // رصيد مجاني
      await user.save();
    }
    
    // البحث عن اللغز النشط
    const activePuzzle = user.puzzles.find(p => p.status === 'active');
    
    if (!activePuzzle) {
      // اللعبة انتهت
      return res.status(200).json({
        message: '🎉 تهانينا! لقد أكملت كل الألغاز!',
        final_message: 'Congratulations you win. Contact me here mrabt3475@gmail.com If you are the first one we gonna to call you. Peace',
        completed: true,
        level: user.level
      });
    }
    
    // جلب الإجابات السابقة للتخزين
    const previousAnswers = {};
    user.puzzles.forEach(p => {
      if (p.completed && p.user_answer) {
        previousAnswers[p.storage_key] = p.user_answer;
      }
    });
    
    res.status(200).json({
      puzzle: {
        id: activePuzzle.id,
        level: activePuzzle.level,
        question: activePuzzle.question,
        hint: activePuzzle.hint,
        type: activePuzzle.type,
        difficulty: activePuzzle.difficulty,
        attempts_remaining: activePuzzle.attempts,
        max_attempts: activePuzzle.max_attempts,
        is_final: activePuzzle.is_final,
        storage_key: activePuzzle.storage_key
      },
      user: {
        freeCredits: user.freeCredits,
        level: user.level,
        completed_puzzles: user.puzzles.filter(p => p.completed).length,
        total_puzzles: user.puzzles.length
      },
      previous_answers: previousAnswers
    });
    
  } catch (err) {
    console.error('Get current puzzle error:', err);
    res.status(500).json({ msg: 'خطأ في جلب اللغز' });
  }
});

// POST /submit - إرسال إجابة
router.post('/submit', auth, async (req, res) => {
  try {
    const user = req.user;
    const { answer } = req.body;
    
    if (!answer) {
      return res.status(400).json({ msg: 'الإجابة مطلوبة' });
    }
    
    // التحقق من الرصيد
    if (user.freeCredits <= 0) {
      return res.status(403).json({ 
        msg: 'انتهى رصيدك المجاني! اشترِ رصيداً للمتابعة',
        need_credits: true
      });
    }
    
    // البحث عن اللغز النشط
    const activePuzzle = user.puzzles.find(p => p.status === 'active');
    
    if (!activePuzzle) {
      return res.status(404).json({ msg: 'لا يوجد لغز نشط' });
    }
    
    // تخزين إجابة المستخدم
    activePuzzle.user_answers.push({
      answer: answer,
      timestamp: Date.now()
    });
    
    // خصم رصيد مجاني
    user.freeCredits -= 1;
    
    // تقليل المحاولات
    activePuzzle.attempts -= 1;
    
    // تخزين الإجابة (مسار واحد - دائماً صحيح)
    activePuzzle.user_answer = answer;
    activePuzzle.completed = true;
    
    // فتح اللغز التالي
    const currentIndex = user.puzzles.findIndex(p => p.id === activePuzzle.id);
    if (currentIndex < user.puzzles.length - 1) {
      user.puzzles[currentIndex + 1].status = 'active';
    }
    
    // تحديث مستوى المستخدم
    user.level = activePuzzle.level + 1;
    user.puzzlesSolved += 1;
    
    await user.save();
    
    // التحقق إذا كان اللغز الأخير
    if (activePuzzle.is_final) {
      res.status(200).json({
        correct: true,
        completed: true,
        message: '🎉 تهانينا! لقد فزت!',
        final_message: 'Congratulations you win. Contact me here mrabt3475@gmail.com If you are the first one we gonna to call you. Peace',
        next_level: null
      });
    } else {
      res.status(200).json({
        correct: true,
        completed: true,
        next_level: activePuzzle.level + 1,
        remaining_credits: user.freeCredits,
        message: '✅ إجابة صحيحة! انتقل للسؤال التالي'
      });
    }
    
  } catch (err) {
    console.error('Submit answer error:', err);
    res.status(500).json({ msg: 'خطأ في إرسال الإجابة' });
  }
});

// POST /skip - تخطي السؤال (يخصم رصيد)
router.post('/skip', auth, async (req, res) => {
  try {
    const user = req.user;
    
    if (user.freeCredits <= 0) {
      return res.status(403).json({ 
        msg: 'انتهى رصيدك المجاني!',
        need_credits: true
      });
    }
    
    const activePuzzle = user.puzzles.find(p => p.status === 'active');
    
    if (!activePuzzle) {
      return res.status(404).json({ msg: 'لا يوجد لغز نشط' });
    }
    
    // تخطي السؤال
    user.freeCredits -= 1;
    activePuzzle.attempts -= 1;
    activePuzzle.skipped = true;
    activePuzzle.completed = true;
    
    // فتح اللغز التالي
    const currentIndex = user.puzzles.findIndex(p => p.id === activePuzzle.id);
    if (currentIndex < user.puzzles.length - 1) {
      user.puzzles[currentIndex + 1].status = 'active';
    }
    
    await user.save();
    
    res.status(200).json({
      skipped: true,
      next_level: activePuzzle.level + 1,
      remaining_credits: user.freeCredits,
      message: '⏭️ تم تخطي السؤال'
    });
    
  } catch (err) {
    console.error('Skip error:', err);
    res.status(500).json({ msg: 'خطأ في تخطي السؤال' });
  }
});

// GET /leaderboard - لوحة المتصدرين
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const topUsers = await User.find({})
      .sort({ puzzlesSolved: -1 })
      .limit(10)
      .select('username puzzlesSolved level');
    
    res.status(200).json({ leaderboard: topUsers });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ msg: 'خطأ في جلب لوحة المتصدرين' });
  }
});

// GET /progress - تقدم المستخدم
router.get('/progress', auth, async (req, res) => {
  try {
    const user = req.user;
    
    res.status(200).json({
      level: user.level,
      puzzlesSolved: user.puzzlesSolved,
      freeCredits: user.freeCredits,
      completed: user.puzzles.filter(p => p.completed).length,
      total: 30
    });
  } catch (err) {
    console.error('Progress error:', err);
    res.status(500).json({ msg: 'خطأ في جلب التقدم' });
  }
});

// POST /buy-credits - شراء رصيد
router.post('/buy-credits', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const user = req.user;
    
    // إضافة رصيد (يتكامل مع نظام الدفع)
    user.freeCredits += amount || 10;
    await user.save();
    
    res.status(200).json({
      success: true,
      new_balance: user.freeCredits,
      message: `تم إضافة ${amount || 10} رصيد`
    });
  } catch (err) {
    console.error('Buy credits error:', err);
    res.status(500).json({ msg: 'خطأ في شراء الرصيد' });
  }
});

module.exports = router;
