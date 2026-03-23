const express = require('express');
const router = express.Router();
const MetaPuzzle = require('../models/MetaPuzzle');
const User = require('../models/User');
const { verifyAccessToken, puzzleLimiter, applyProgressiveDelay, verifyRequestSignature, isBlocked, logActivity, sanitizeObject } = require('../middleware/security');

router.post('/start', verifyAccessToken, isBlocked, puzzleLimiter, applyProgressiveDelay, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { level } = sanitizeObject(req.body);
        if (!level || level < 21 || level > 30) return res.status(400).json({error:'Level must be 21-30'});
        const user = await User.findById(userId);
        const prevResults = user.gameData.keys || [];
        const puzzle = await MetaPuzzle.startPuzzle(userId, level, prevResults);
        if (puzzle.error) return res.status(404).json({error:puzzle.error});
        logActivity(userId, 'meta_puzzle_started', {level});
        res.json({success:true, puzzleId:puzzle.puzzleId, level:puzzle.level, puzzleType:puzzle.puzzleType, story:puzzle.story, storyAr:puzzle.storyAr, question:puzzle.question, questionAr:puzzle.questionAr, hint:puzzle.hint, hintAr:puzzle.hintAr, challenge:puzzle.challenge||puzzle, keyFragment:puzzle.keyFragment, points:puzzle.points, timeLimit:puzzle.timeLimit, maxAttempts:puzzle.maxAttempts, message:'MRABT Level '+level+' started!'});
    } catch (e) { res.status(500).json({error:'Failed to start puzzle'}); }
});

router.post('/submit', verifyAccessToken, verifyRequestSignature, isBlocked, puzzleLimiter, applyProgressiveDelay, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { puzzleId, answer, params, attemptNumber, allShares } = sanitizeObject(req.body);
        if (!puzzleId || !answer) return res.status(400).json({error:'Missing fields'});
        const result = await MetaPuzzle.submitAnswer(userId, puzzleId, answer, params, attemptNumber||1, {allShares});
        if (result.correct) {
            const user = await User.findById(userId);
            if (result.keyFragment && !user.gameData.keys.includes(result.keyFragment)) user.gameData.keys.push(result.keyFragment);
            user.gameData.totalScore += result.points;
            user.stats.puzzlesSolved++;
            await user.save();
            logActivity(userId, 'meta_puzzle_completed', {level:result.level, keyFragment:result.keyFragment});
            res.json({success:true, message:result.message, level:result.level, points:result.points, keyFragment:result.keyFragment, finalKey:result.level===30?user.gameData.keys.join(''):null, nextLevel:result.level<30?result.level+1:null});
        } else { res.json({success:false, message:result.message}); }
    } catch (e) { res.status(500).json({error:'Failed to submit'}); }
});

router.get('/hint/:puzzleId', verifyAccessToken, async (req, res) => {
    try {
        const puzzle = await MetaPuzzle.findById(req.params.puzzleId);
        if (!puzzle) return res.status(404).json({error:'Not found'});
        res.json({success:true, hint:puzzle.hint, hintAr:puzzle.hintAr, pointsPenalty:10});
    } catch (e) { res.status(500).json({error:'Failed'}); }
});

router.get('/progress', verifyAccessToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        res.json({success:true, keys:user.gameData.keys, finalKey:user.gameData.keys.length===10?user.gameData.keys.join(''):null, totalScore:user.gameData.totalScore});
    } catch (e) { res.status(500).json({error:'Failed'}); }
});

module.exports = router;