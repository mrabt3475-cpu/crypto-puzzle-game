/**
 * 🎮 Puzzle Routes API
 * واجهة برمجة الألغاز
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const UserPuzzleState = require('../models/UserPuzzleState');
const {
    verifyAccessToken,
    generateDeviceFingerprint,
    puzzleAttemptLimiter,
    progressiveDelayLimiter,
    verifyRequestSignature,
    detectBot,
    isIPBlocked,
    logActivity,
    logSuspiciousActivity,
    sanitizeObject
} = require('../middleware/advancedSecurity');

// ============== Start Puzzle ==============

router.post('/start', 
    verifyAccessToken,
    isIPBlocked,
    puzzleAttemptLimiter,
    progressiveDelayLimiter,
    async (req, res) => {
        try {
            const userId = req.user.userId;
            const { level } = sanitizeObject(req.body);
            const deviceFingerprint = generateDeviceFingerprint(req);
            const ipAddress = req.ip;
            
            // Get user's current level if not specified
            const userState = await UserPuzzleState.getUserState(userId);
            const targetLevel = level || userState.currentLevel;
            
            // Check if previous level is completed
            if (targetLevel > 1) {
                const prevState = await UserPuzzleState.findOne({
                    userId,
                    level: targetLevel - 1,
                    status: 'completed'
                });
                
                if (!prevState) {
                    return res.status(400).json({
                        error: 'Complete previous level first'
                    });
                }
            }
            
            // Start the puzzle
            const puzzle = await UserPuzzleState.startPuzzle(
                userId,
                targetLevel,
                deviceFingerprint,
                ipAddress
            );
            
            logActivity(userId, 'puzzle_started', { level: targetLevel });
            
            res.json({
                success: true,
                puzzleId: puzzle.userStateId,
                level: puzzle.level,
                puzzleType: puzzle.puzzleType,
                challenge: puzzle.challenge,
                timeLimit: puzzle.timeLimit,
                maxAttempts: puzzle.maxAttempts,
                message: 'Puzzle started. Good luck!'
            });
            
        } catch (error) {
            console.error('Start Puzzle Error:', error);
            res.status(500).json({ error: error.message || 'Failed to start puzzle' });
        }
    }
);

// ============== Submit Answer ==============

router.post('/submit',
    verifyAccessToken,
    verifyRequestSignature,
    isIPBlocked,
    puzzleAttemptLimiter,
    progressiveDelayLimiter,
    async (req, res) => {
        try {
            const userId = req.user.userId;
            const { puzzleId, answer, interactionData } = sanitizeObject(req.body);
            
            // Detect bot behavior
            const botDetection = detectBot(req);
            if (botDetection.isBot) {
                logSuspiciousActivity(userId, 'bot_detected', {
                    indicators: botDetection.indicators,
                    riskScore: botDetection.riskScore
                });
                
                return res.status(403).json({
                    error: 'Suspicious activity detected'
                });
            }
            
            // Submit answer
            const result = await UserPuzzleState.submitAnswer(
                puzzleId,
                answer,
                interactionData
            );
            
            if (result.valid) {
                logActivity(userId, 'puzzle_completed', {
                    level: result.level,
                    key: result.newKey
                });
                
                res.json({
                    success: true,
                    message: '🎉 Correct! Well done!',
                    level: result.level,
                    newKey: result.newKey,
                    nextLevel: result.nextLevel,
                    nextPuzzle: `/api/puzzle/start?level=${result.nextLevel}`
                });
            } else {
                if (result.penalty) {
                    logSuspiciousActivity(userId, 'penalty_applied', {
                        reason: result.reason,
                        cooldown: result.cooldownMinutes
                    });
                    
                    return res.status(403).json({
                        success: false,
                        error: result.reason,
                        cooldownMinutes: result.cooldownMinutes,
                        message: `Too many wrong attempts. Cooldown: ${result.cooldownMinutes} minutes`
                    });
                }
                
                res.json({
                    success: false,
                    message: '❌ Wrong answer. Try again!',
                    attemptsRemaining: result.attemptsRemaining,
                    hint: result.hint
                });
            }
            
        } catch (error) {
            console.error('Submit Answer Error:', error);
            res.status(500).json({ error: 'Failed to submit answer' });
        }
    }
);

// ============== Get User Progress ==============

router.get('/progress',
    verifyAccessToken,
    async (req, res) => {
        try {
            const userId = req.user.userId;
            const progress = await UserPuzzleState.getUserState(userId);
            
            res.json({
                success: true,
                progress
            });
            
        } catch (error) {
            console.error('Get Progress Error:', error);
            res.status(500).json({ error: 'Failed to get progress' });
        }
    }
);

// ============== Get Hint ==============

router.get('/hint/:puzzleId',
    verifyAccessToken,
    async (req, res) => {
        try {
            const userId = req.user.userId;
            const { puzzleId } = req.params;
            
            const userState = await UserPuzzleState.findById(puzzleId);
            
            if (!userState) {
                return res.status(404).json({ error: 'Puzzle not found' });
            }
            
            if (userState.userId.toString() !== userId) {
                return res.status(403).json({ error: 'Not authorized' });
            }
            
            const puzzleData = userState.state.puzzleData;
            
            // Decrease points for using hint
            userState.state.context.hintsUsed++;
            await userState.save();
            
            res.json({
                success: true,
                hint: puzzleData.hint,
                pointsPenalty: userState.state.context.hintsUsed * 5
            });
            
        } catch (error) {
            console.error('Get Hint Error:', error);
            res.status(500).json({ error: 'Failed to get hint' });
        }
    }
);

// ============== Get Leaderboard ==============

router.get('/leaderboard',
    async (req, res) => {
        try {
            const topPlayers = await UserPuzzleState.aggregate([
                { $match: { status: 'completed' } },
                {
                    $group: {
                        _id: '$userId',
                        completedLevels: { $sum: 1 },
                        totalKeys: { $sum: { $size: '$state.keys' } },
                        totalTime: { $sum: '$state.timeSpent' }
                    }
                },
                { $sort: { completedLevels: -1, totalTime: 1 } },
                { $limit: 10 }
            ]);
            
            res.json({
                success: true,
                leaderboard: topPlayers
            });
            
        } catch (error) {
            console.error('Leaderboard Error:', error);
            res.status(500).json({ error: 'Failed to get leaderboard' });
        }
    }
);

module.exports = router;
