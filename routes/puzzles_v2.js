const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
  puzzles, 
  generateUserPuzzles, 
  validateAnswer, 
  buildFinalMessage,
  canUnlockNext
} = require('../config/puzzles_v2');
const User = require('../models/User');

// ═══════════════════════════════════════════════════════
// GET /current - جلب اللغز الحالي مع التحقق
// ═══════════════════════════════════════════════════════

router.get('/current', auth, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.puzzles || user.puzzles.length === 0) {
      user.puzzles = generateUserPuzzles(user._id.toString());
      user.freeCredits = 10;
      await user.save();
    }
    
    const activePuzzle = user.puzzles.find(p => p.status === 'active');
    
    if (!activePuzzle) {
      const finalMessage = buildFinalMessage(user.puzzles);
      return res.status(200).json({
        completed: true,
        message: '🎉 تهانينا! لقد أكملت كل الألغاز!',
        final_message: finalMessage,
        total_points: user.puzzles.reduce((sum, p) => sum + (p.completed ? p.points : 0), 0)
      });
    }
    
    if (!canUnlockNext(activePuzzle, user.puzzles)) {
      const lockedReasons = activePuzzle.depends_on
        .filter(depId => {
          const dep = user.puzzles.find(p => p.id === depId);
          return !dep || !dep.completed;
        })
        .map(depId => {
          const dep = user.puzzles.find(p => p.id === depId);
          return `سؤال ${dep?.level}: ${dep?.storage_key}`;
        });
      
      return res.status(403).json({
        locked: true,
        message: 'أكمل الأسئلة السابقة أولاً!',
        locked_by: lockedReasons
      });
    }
    
    const previousAnswers = {};
    user.puzzles.forEach(p => {
      if (p.completed && p.user_answer) {
        previousAnswers[p.storage_key] = p.user_answer;
      }
    });
    
    let question = activePuzzle.question;
    if (activePuzzle.requires_chain && activePuzzle.depends_on) {
      activePuzzle.depends_on.forEach(depId => {
        const dep = user.puzzles.find(p => p.id === depId);
        if (dep && dep.user_answer) {
          question = question.replace('{prev_answer}', dep.user_answer);
        }
      });
    }
    
    res.status(200).json({
      puzzle: {
        id: activePuzzle.id,
        level: activePuzzle.level,
        difficulty: activePuzzle.difficulty,
        type: activePuzzle.type,
        category: activePuzzle.category,
        question: question,
        hint: activePuzzle.hint,
        points: activePuzzle.points,
        attempts_remaining: activePuzzle.max_attempts - activePuzzle.attempts,
        max_attempts: activePuzzle.max_attempts,
        is_final: activePuzzle.is_final,
        is_chain_starter: activePuzzle.is_chain_starter,
        depends_on: activePuzzle.depends_on,
        requires_chain: activePuzzle.requires_chain
      },
      user: {
        freeCredits: user.freeCredits,
        level: user.level,
        completed_puzzles: user.puzzles.filter(p => p.completed).length,
        total_puzzles: user.puzzles.length,
        total_points: user.puzzles.reduce((sum, p) => sum + (p.completed ? p.points : 0), 0)
      },
      previous_answers: previousAnswers
    });
    
  } catch (err) {
    console.error('Get current puzzle error:', err);
    res.status(500).json({ msg: 'خطأ في جلب اللغز' });
  }
});

// ═══════════════════════════════════════════════════════
// POST /submit - إرسال إجابة مع التحقق
// ═══════════════════════════════════════════════════════

router.post('/submit', auth, async (req, res) => {
  try {
    const user = req.user;
    const { answer } = req.body;
    
    if (!answer) {
      return res.status(400).json({ msg: 'الإجابة مطلوبة' });
    }
    
    if (user.freeCredits <= 0) {
      return res.status(403).json({ 
        msg: 'انتهى رصيدك المجاني! اشترِ رصيداً للمتابعة',
        need_credits: true
      });
    }
    
    const activePuzzle = user.puzzles.find(p => p.status === 'active');
    
    if (!activePuzzle) {
      return res.status(404).json({ msg: 'لا يوجد لغز نشط' });
    }
    
    if (!canUnlockNext(activePuzzle, user.puzzles)) {
      return res.status(403).json({ 
        msg: 'أكمل الأسئلة السابقة أولاً!',
        locked: true
      });
    }
    
    const isCorrect = validateAnswer(activePuzzle, answer, user.puzzles);
    
    activePuzzle.user_answers.push({
      answer: answer,
      is_correct: isCorrect,
      timestamp: Date.now()
    });
    
    user.freeCredits -= 1;
    activePuzzle.attempts += 1;
    
    if (isCorrect) {
      activePuzzle.user_answer = answer;
      activePuzzle.completed = true;
      
      const currentIndex = user.puzzles.findIndex(p => p.id === activePuzzle.id);
      if (currentIndex < user.puzzles.length - 1) {
        const nextPuzzle = user.puzzles[currentIndex + 1];
        
        if (canUnlockNext(nextPuzzle, user.puzzles)) {
          nextPuzzle.status = 'active';
        } else {
          for (let i = currentIndex + 1; i < user.puzzles.length; i++) {
            if (canUnlockNext(user.puzzles[i], user.puzzles)) {
              user.puzzles[i].status = 'active';
              break;
            }
          }
        }
      }
      
      user.level = activePuzzle.level + 1;
      user.puzzlesSolved += 1;
      user.totalScore += activePuzzle.points;
      
      await user.save();
      
      if (activePuzzle.is_final) {
        const finalMessage = buildFinalMessage(user.puzzles);
        res.status(200).json({
          correct: true,
          completed: true,
          message: '🎉 تهانينا! لقد فزت!',
          final_message: finalMessage,
          total_points: user.totalScore,
          next_level: null
        });
      } else {
        res.status(200).json({
          correct: true,
          completed: true,
          next_level: activePuzzle.level + 1,
          remaining_credits: user.freeCredits,
          message: '✅ إجابة صحيحة! انتقل للسؤال التالي',
          points_earned: activePuzzle.points,
          total_points: user.totalScore
        });
      }
    } else {
      await user.save();
      
      if (activePuzzle.attempts >= activePuzzle.max_attempts) {
        res.status(400).json({
          correct: false,
          attempts_used: activePuzzle.attempts,
          max_attempts: activePuzzle.max_attempts,
          message: '❌ انتهت محاولاتك! اشترِ رصيد للمتابعة',
          need_credits: true
        });
      } else {
        res.status(400).json({
          correct: false,
          attempts_used: activePuzzle.attempts,
          max_attempts: activePuzzle.max_attempts,
          remaining_attempts: activePuzzle.max_attempts - activePuzzle.attempts,
          message: '❌ إجابة خاطئة! حاول مرة أخرى',
          hint: activePuzzle.hint
        });
      }
    }
    
  } catch (err) {
    console.error('Submit answer error:', err);
    res.status(500).json({ msg: 'خطأ في إرسال الإجابة' });
  }
});

// ═══════════════════════════════════════════════════════
// POST /skip - تخطي السؤال
// ═══════════════════════════════════════════════════════

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
    
    user.freeCredits -= 1;
    activePuzzle.attempts += 1;
    activePuzzle.skipped = true;
    activePuzzle.completed = true;
    activePuzzle.user_answer = 'SKIPPED';
    
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

// ═══════════════════════════════════════════════════════
// GET /progress - تقدم المستخدم
// ═══════════════════════════════════════════════════════

router.get('/progress', auth, async (req, res) => {
  try {
    const user = req.user;
    
    const completed = user.puzzles.filter(p => p.completed);
    const easy = completed.filter(p => p.difficulty === 'easy').length;
    const medium = completed.filter(p => p.difficulty === 'medium').length;
    const hard = completed.filter(p => p.difficulty === 'hard').length;
    
    res.status(200).json({
      level: user.level,
      puzzlesSolved: user.puzzlesSolved,
      totalScore: user.totalScore,
      freeCredits: user.freeCredits,
      completed: completed.length,
      total: 30,
      breakdown: {
        easy: { completed: easy, total: 10 },
        medium: { completed: medium, total: 10 },
        hard: { completed: hard, total: 10 }
      }
    });
  } catch (err) {
    console.error('Progress error:', err);
    res.status(500).json({ msg: 'خطأ في جلب التقدم' });
  }
});

// ═══════════════════════════════════════════════════════
// GET /leaderboard - لوحة المتصدرين
// ═══════════════════════════════════════════════════════

router.get('/leaderboard', auth, async (req, res) => {
  try {
    const topUsers = await User.find({})
      .sort({ totalScore: -1, puzzlesSolved: -1 })
      .limit(10)
      .select('username totalScore puzzlesSolved level');
    
    res.status(200).json({ leaderboard: topUsers });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ msg: 'خطأ في جلب لوحة المتصدرين' });
  }
});

// ═══════════════════════════════════════════════════════
// POST /buy-credits - شراء رصيد
// ═══════════════════════════════════════════════════════

router.post('/buy-credits', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const user = req.user;
    
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

// ═══════════════════════════════════════════════════════
// GET /validate/:puzzleId - التحقق من إجابة سؤال معين
// ═══════════════════════════════════════════════════════

router.get('/validate/:puzzleId', auth, async (req, res) => {
  try {
    const { puzzleId } = req.params;
    const { answer } = req.query;
    const user = req.user;
    
    const puzzle = user.puzzles.find(p => p.id === puzzleId);
    
    if (!puzzle) {
      return res.status(404).json({ msg: 'اللغز غير موجود' });
    }
    
    const isCorrect = validateAnswer(puzzle, answer, user.puzzles);
    
    res.status(200).json({
      puzzle_id: puzzleId,
      answer: answer,
      is_correct: isCorrect,
      hint: isCorrect ? null : puzzle.hint
    });
  } catch (err) {
    console.error('Validate error:', err);
    res.status(500).json({ msg: 'خطأ في التحقق' });
  }
});

module.exports = router;