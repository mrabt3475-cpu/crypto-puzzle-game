/**
 * 💰 Payment Routes
 * API endpoints for Binance payment integration
 */

const express = require('express');
const router = express.Router();
const binancePayment = require('../utils/binancePayment');
const { validate, schemas } = require('../middleware/validation');
const auth = require('../middleware/auth');
const { logger } = require('../config/logger');

// POST /api/payment/create - Create payment invoice
router.post('/create', auth, validate(schemas.paymentCreate), async (req, res) => {
    try {
        const { amount, network } = req.validatedBody;
        const userId = req.user.id;

        logger.info('Payment request: user=' + userId + ', amount=' + amount);

        const result = await binancePayment.createInvoice(amount, network, userId);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

        // Save payment to database
        // await PaymentModel.create({ ... });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Payment creation failed:', error);
        res.status(500).json({
            success: false,
            error: 'Payment creation failed'
        });
    }
});

// POST /api/payment/webhook - Binance webhook callbackrouter.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        const payload = req.body;

        if (!binancePayment.verifyWebhook(payload, signature)) {
            logger.warn('Invalid webhook signature');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        logger.info('Payment webhook received:', payload);

        const { paymentId, txHash, amount, status } = payload;

        if (status === 'success') {
            // Update payment status in database
            // await PaymentModel.updateStatus(paymentId, 'completed', txHash);

            // Credit user account
            // await UserModel.creditBalance(paymentId, amount);

            logger.info('Payment completed: ' + paymentId + ', amount: ' + amount);
        }

        res.json({ success: true });
    } catch (error) {
        logger.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// GET /api/payment/status/:paymentId - Check payment status
router.get('/status/:paymentId', auth, async (req, res) => {
    try {
        const { paymentId } = req.params;

        // Get payment from database
        // const payment = await PaymentModel.findOne({ paymentId });

        res.json({
            success: true,
            data: {
                paymentId,
                status: 'pending', // pending, completed, failed
                confirmations: 0
            }
        });
    } catch (error) {
        logger.error('Payment status check failed:', error);
        res.status(500).json({ error: 'Failed to check payment status' });
    }
});

// GET /api/payment/networks - Get available networks
router.get('/networks', (req, res) => {
    res.json({
        success: true,
        data: [
            { id: 'TRC20', name: 'TRON (TRC20)', symbol: 'USDT', fees: '1 USDT' },
            { id: 'ERC20', name: 'Ethereum (ERC20)', symbol: 'USDT', fees: '~5-10 USDT' },
            { id: 'BEP20', name: 'BNB Chain (BEP20)', symbol: 'USDT', fees: '~0.5 USDT' }
        ]
    });
});

module.exports = router;
