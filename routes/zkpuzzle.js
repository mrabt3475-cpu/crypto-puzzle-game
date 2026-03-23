const express = require('express');
const router = express.Router();
const ZKPuzzle = require('../models/ZKPuzzle');
const User = require('../models/User');
const { verifyAccessToken, strictLimiter, puzzleLimiter, applyProgressiveDelay, verifyRequestSignature, isBlocked, logActivity, sanitizeObject } = require('../middleware/security');

router.post('/start', verifyAccessToken, isBlocked, puzzleLimiter, applyProgressiveDelay, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { level } = sanitizeObject(req.body);
        const user = await User.findById(userId);
        const targetLevel = level || user.gameData.currentLevel || 1;
        if (targetLevel > 1 && !user.gameData.completedLevels.includes(targetLevel - 1)) return res.status(400).json({ error: 'Complete previous level first' });
        const puzzle = await ZKPuzzle.startPuzzle(userId, targetLevel);
        if (puzzle.error) return res.status(404).json({ error: puzzle.error });
        logActivity(userId, 'zk_puzzle_started', { level: targetLevel });
        res.json({ success: true, puzzleId: puzzle.puzzleId, level: puzzle.level, puzzleType: puzzle.puzzleType, question: puzzle.question, questionAr: puzzle.questionAr, hint: puzzle.hint, challenge: puzzle.challenge, challengeId: puzzle.challengeId, timeLimit: puzzle.timeLimit, maxAttempts: puzzle.maxAttempts, message: 'Puzzle started!' });
    } catch (error) { res.status(500).json({ error: 'Failed to start puzzle' }); }
});

router.post('/submit', verifyAccessToken, verifyRequestSignature, isBlocked, puzzleLimiter, applyProgressiveDelay, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { puzzleId, answer, challengeId, challenge } = sanitizeObject(req.body);
        if (!puzzleId || !answer) return res.status(400).json({ error: 'Missing required fields' });
        const challengeData = challengeId ? { challengeId, challenge } : {};
        const result = await ZKPuzzle.submitAnswer(userId, puzzleId, answer, challengeData);
        if (result.correct) {
            const user = await User.findById(userId);
            if (!user.gameData.completedLevels.includes(result.level)) {
                user.gameData.completedLevels.push(result.level);
                user.gameData.currentLevel = result.level + 1;
                user.gameData.totalScore += result.points;
                user.stats.puzzlesSolved++;
                await user.save();
            }
            logActivity(userId, 'zk_puzzle_completed', { level: result.level, points: result.points });
            res.json({ success: true, message: result.message, level: result.level, points: result.points, nextLevel: result.level + 1 });
        } else { res.json({ success: false, message: result.message }); }
    } catch (error) { res.status(500).json({ error: 'Failed to submit answer' }); }
});

router.get('/hint/:puzzleId', verifyAccessToken, async (req, res) => {
    try {
        const puzzle = await ZKPuzzle.findById(req.params.puzzleId);
        if (!puzzle) return res.status(404).json({ error: 'Puzzle not found' });
        res.json({ success: true, hint: puzzle.hint, hintAr: puzzle.hintAr, pointsPenalty: 5 });
    } catch (error) { res.status(500).json({ error: 'Failed to get hint' }); }
});

router.get('/progress', verifyAccessToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        res.json({ success: true, currentLevel: user.gameData.currentLevel, completedLevels: user.gameData.completedLevels, totalScore: user.gameData.totalScore });
    } catch (error) { res.status(500).json({ error: 'Failed to get progress' }); }
});

router.get('/leaderboard', async (req, res) => {
    try {
        const topPlayers = await User.find({}).sort({ 'gameData.totalScore': -1 }).limit(10).select('username gameData.totalScore gameData.completedLevels');
        res.json({ success: true, leaderboard: topPlayers.map((u, i) => ({ rank: i + 1, username: u.username, score: u.gameData.totalScore, levelsCompleted: u.gameData.completedLevels.length })) });
    } catch (error) { res.status(500).json({ error: 'Failed to get leaderboard' }); }
});

module.exports = router;