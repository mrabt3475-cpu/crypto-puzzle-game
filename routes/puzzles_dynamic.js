/**
 * Puzzle Routes - Dynamic 30-Level Puzzle Game with Payment Integration
 */

const express = require('express');
const crypto = require('crypto');
const { generateSeed, generateQuestion, TOTAL_LEVELS } = require('../config/puzzles_dynamic');
const { 
  rateLimiter, 
  validateInput, 
  checkAntiCheat, 
  generateSecureToken, 
  securityLog 
} = require('../middleware/securityAdvanced');
const { Payment, requiresPayment, getLevelPrice } = require('../models/Payment');

const router = express.Router();
const users = new Map();
const paymentSystem = new Payment();

// START NEW GAME
router.post('/start', rateLimiter, (req, res) => {
  try {
    const { userId } = req.body;
    const validation = validateInput(userId, 'userId');
    if (!validation.valid) {
      return res.status(400).json({ error: validation.errors.join(', ') });
    }
    
    const seed = generateSeed(userId);
    const sessionToken = generateSecureToken(32);
    
    const userSession = {
      userId,
      seed,
      sessionToken,
      currentLevel: 1,
      history: {},
      startedAt: Date.now(),
      completedAt: null,
      rewardKey: null
    };
    
    users.set(userId, userSession);
    const questionData = generateQuestion(1, seed);
    const question = questionData.generate(seed);
    
    securityLog('game_start', { userId, level: 1 });
    
    res.json({
      success: true,
      message: '🎮 بدأت اللعبة! حل 30 سؤالاً للمكافأة',
      level: 1,
      totalLevels: TOTAL_LEVELS,
      question: question.question || questionData.question,
      hint: questionData.hint,
      sessionToken
    });
    
  } catch (error) {
    console.error('Start game error:', error);
    securityLog('error', { error: error.message, endpoint: '/start' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET CURRENT QUESTION (with payment check)
router.get('/question/:level', rateLimiter, (req, res) => {
  try {
    const { level } = req.params;
    const { userId, sessionToken } = req.headers;
    const levelNum = parseInt(level);
    
    if (!userId || !sessionToken) {
      return res.status(401).json({ error: 'Unauthorized - Missing credentials' });
    }
    
    if (isNaN(levelNum) || levelNum < 1 || levelNum > TOTAL_LEVELS) {
      return res.status(400).json({ error: 'Invalid level' });
    }
    
    const user = users.get(userId);
    if (!user) {
      return res.status(404).json({ error: 'Game not started. Call /start first' });
    }
    
    if (user.sessionToken !== sessionToken) {
      securityLog('invalid_token', { userId, level: levelNum });
      return res.status(401).json({ error: 'Invalid session token' });
    }
    
    // Check if level requires payment
    if (requiresPayment(levelNum)) {
      const isPaid = paymentSystem.isLevelPaid(userId, levelNum);
      if (!isPaid) {
        const pricing = getLevelPrice(levelNum);
        return res.status(402).json({
          error: 'Payment required',
          level: levelNum,
          price: pricing.price,
          currency: pricing.currency,
          message: `المستوى ${levelNum} يتطلب دفع ${pricing.price} USDT`,
          paymentRequired: true,
          paymentEndpoint: '/api/payment/create'
        });
      }
    }
    
    if (levelNum > user.currentLevel) {
      return res.status(403).json({ 
        error: 'Complete previous levels first',
        currentLevel: user.currentLevel,
        requestedLevel: levelNum
      });
    }
    
    const questionData = generateQuestion(levelNum, user.seed, null, user.history);
    const question = questionData.generate(user.seed, null, user.history);
    
    res.json({
      success: true,
      level: levelNum,
      totalLevels: TOTAL_LEVELS,
      question: question.question || questionData.question,
      hint: questionData.hint,
      type: questionData.type,
      progress: Math.round((user.currentLevel / TOTAL_LEVELS) * 100)
    });
    
  } catch (error) {
    console.error('Get question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SUBMIT ANSWER
router.post('/answer', rateLimiter, (req, res) => {
  try {
    const { userId, level, answer, sessionToken } = req.body;
    
    if (!userId || !level || !answer || !sessionToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const levelNum = parseInt(level);
    const answerValidation = validateInput(answer, 'answer');
    if (!answerValidation.valid) {
      return res.status(400).json({ error: answerValidation.errors.join(', ') });
    }
    
    const cheatCheck = checkAntiCheat(userId, levelNum, answer);
    if (cheatCheck.blocked) {
      securityLog('cheat_detected', { userId, level: levelNum, reason: cheatCheck.reason });
      return res.status(429).json({
        error: 'Too many failed attempts',
        blocked: true,
        remainingTime: cheatCheck.remainingTime,
        message: cheatCheck.reason || 'تم اكتشاف نشاط مشبوه'
      });
    }
    
    const user = users.get(userId);
    if (!user) {
      return res.status(404).json({ error: 'Game not started' });
    }
    
    if (user.sessionToken !== sessionToken) {
      securityLog('invalid_token', { userId, level: levelNum });
      return res.status(401).json({ error: 'Invalid session token' });
    }
    
    // Check payment for paid levels
    if (requiresPayment(levelNum)) {
      const isPaid = paymentSystem.isLevelPaid(userId, levelNum);
      if (!isPaid) {
        const pricing = getLevelPrice(levelNum);
        return res.status(402).json({
          error: 'Payment required',
          level: levelNum,
          price: pricing.price,
          currency: pricing.currency
        });
      }
    }
    
    if (levelNum !== user.currentLevel) {
      return res.status(400).json({ 
        error: 'Invalid level order',
        currentLevel: user.currentLevel,
        submittedLevel: levelNum
      });
    }
    
    const questionData = generateQuestion(levelNum, user.seed, null, user.history);
    const validation = questionData.validate(answerValidation.sanitized, null, user.seed, user.history);
    
    if (!validation.valid) {
      securityLog('wrong_answer', { userId, level: levelNum });
      return res.json({
        success: false,
        correct: false,
        message: validation.message || 'إجابة خاطئة',
        hint: questionData.hint
      });
    }
    
    user.history[levelNum] = {
      answer: answerValidation.sanitized,
      partialKey: validation.partialKey,
      solvedAt: Date.now(),
      attempts: (user.history[levelNum]?.attempts || 0) + 1
    };
    
    if (validation.isFinal || validation.isReward) {
      user.completedAt = Date.now();
      user.rewardKey = validation.nextKey;
      securityLog('game_completed', { userId, time: user.completedAt - user.startedAt });
      return res.json({
        success: true,
        correct: true,
        message: '🎉 تهانينا! أكملت اللعبة!',
        isFinal: true,
        rewardKey: user.rewardKey,
        totalTime: user.completedAt - user.startedAt,
        stats: { totalLevels: TOTAL_LEVELS, completed: Object.keys(user.history).length }
      });
    }
    
    user.currentLevel++;
    const nextQuestionData = generateQuestion(user.currentLevel, user.seed, null, user.history);
    const nextQuestion = nextQuestionData.generate(user.seed, null, user.history);
    
    securityLog('correct_answer', { userId, level: levelNum, nextLevel: user.currentLevel });
    
    res.json({
      success: true,
      correct: true,
      message: '✅ إجابة صحيحة!',
      nextLevel: user.currentLevel,
      totalLevels: TOTAL_LEVELS,
      nextQuestion: nextQuestion.question || nextQuestionData.question,
      hint: nextQuestionData.hint,
      progress: Math.round((user.currentLevel / TOTAL_LEVELS) * 100),
      partialKey: validation.partialKey
    });
    
  } catch (error) {
    console.error('Submit answer error:', error);
    securityLog('error', { error: error.message, endpoint: '/answer' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET PROGRESS
router.get('/progress', (req, res) => {
  try {
    const { userId, sessionToken } = req.headers;
    if (!userId || !sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = users.get(userId);
    if (!user) {
      return res.status(404).json({ error: 'Game not started' });
    }
    if (user.sessionToken !== sessionToken) {
      return res.status(401).json({ error: 'Invalid session token' });
    }
    
    // Get paid levels
    const paidLevels = [];
    for (let i = 1; i <= TOTAL_LEVELS; i++) {
      if (requiresPayment(i)) {
        paidLevels.push({
          level: i,
          paid: paymentSystem.isLevelPaid(userId, i),
          price: getLevelPrice(i).price
        });
      }
    }
    
    res.json({
      success: true,
      userId: user.userId,
      currentLevel: user.currentLevel,
      totalLevels: TOTAL_LEVELS,
      progress: Math.round((user.currentLevel / TOTAL_LEVELS) * 100),
      completedLevels: Object.keys(user.history).length,
      isCompleted: !!user.completedAt,
      startedAt: user.startedAt,
      completedAt: user.completedAt,
      paidLevels
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET HINT
router.get('/hint/:level', (req, res) => {
  try {
    const { level } = req.params;
    const { userId, sessionToken } = req.headers;
    const levelNum = parseInt(level);
    if (!userId || !sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = users.get(userId);
    if (!user || user.sessionToken !== sessionToken) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    if (levelNum > user.currentLevel) {
      return res.status(403).json({ error: 'Level not unlocked' });
    }
    const questionData = generateQuestion(levelNum, user.seed, null, user.history);
    res.json({ success: true, level: levelNum, hint: questionData.hint, type: questionData.type });
  } catch (error) {
    console.error('Get hint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// HEALTH CHECK
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    game: 'Crypto Puzzle Game', 
    version: '2.0', 
    levels: TOTAL_LEVELS, 
    activeUsers: users.size 
  });
});

module.exports = router;
