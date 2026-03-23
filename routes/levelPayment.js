/**
 * 💰 Level Payment Routes
 * API endpoints for level-based payments
 */

const express = require('express');
const router = express.Router();
const levelPayment = require('../utils/levelPayment');
const auth = require('../middleware/auth');
const { logger } = require('../config/logger');

// GET /api/payment/level-requirements - Get payment requirements
router.get('/level-requirements', (req, res) => {
    res.json({
        success: true,
        data: {
            paymentRequiredLevel: 10,
            paymentAmount: 0.01,
            currency: 'USDT',
            freeLevels: 9,
            totalLevels: 20,
            networks: levelPayment.getAvailableNetworks()
        }
    });
});

// GET /api/payment/calculate/:network - Calculate payment with gas
router.get('/calculate/:network', auth, (req, res) => {
    const { network } = req.params;
    const calculation = levelPayment.calculatePaymentWithGas(network);

    res.json({
        success: true,
        data: calculation
    });
});

// POST /api/payment/level10 - Create payment for level 10
router.post('/level10', auth, async (req, res) => {
    try {
        const { network } = req.body;
        const userId = req.user.id;

        logger.info('Level 10 payment request: user=' + userId + ', network=' + (network || 'TRC20'));

        // Check if already paid
        const hasPaid = await levelPayment.hasUserPaid(userId);
        if (hasPaid) {
            return res.status(400).json({
                success: false,
                error: 'Payment already completed for Level 10'
            });
        }

        // Create payment invoice
        const result = await levelPayment.createLevelPayment(userId, network || 'TRC20');

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Level 10 payment creation failed:', error);
        res.status(500).json({
            success: false,
            error: 'Payment creation failed'
        });
    }
});

// GET /api/payment/my-progress - Get user payment progress
router.get('/my-progress', auth, async (req, res) => {
    try {
        const user = req.user; // Get from auth middleware
        const progress = levelPayment.getUserProgress(user);

        res.json({
            success: true,
            data: progress
        });
    } catch (error) {
        logger.error('Get progress failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get progress'
        });
    }
});

// POST /api/payment/verify-level10 - Verify level 10 payment
router.post('/verify-level10', auth, async (req, res) => {
    try {
        const { paymentId, txHash } = req.body;
        const userId = req.user.id;

        logger.info('Verifying level 10 payment: user=' + userId + ', paymentId=' + paymentId);

        // Check payment status in database
        // const payment = await Transaction.findOne({ paymentId, userId });

        // For demo, return pending
        res.json({
            success: true,
            data: {
                paymentId,
                status: 'pending',
                message: 'Payment verification in progress'
            }
        });
    } catch (error) {
        logger.error('Payment verification failed:', error);
        res.status(500).json({
            success: false,
            error: 'Verification failed'
        });
    }
});

module.exports = router;
