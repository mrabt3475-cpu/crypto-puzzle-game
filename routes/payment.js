const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

const Payment = require('../models/Payment');
const User = require('../models/User');
const { verifyAccessToken, paymentLimiter, sanitizeObject, logActivity } = require('../middleware/security');

const BINANCE_API_URL = 'https://binancepay.binance.com';
const BINANCE_MERCHANT_ID = process.env.BINANCE_MERCHANT_ID;
const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET;

function binanceSignature(queryString, timestamp) {
    const message = timestamp + '\n' + queryString;
    return crypto.createHmac('sha256', BINANCE_API_SECRET).update(message).digest('hex');
}

async function createBinanceOrder(amount, currency = 'USDT', description = 'Puzzle Game Credits') {
    const timestamp = Date.now();
    const queryString = `amount=${amount}&currency=${currency}&merchantId=${BINANCE_MERCHANT_ID}&description=${encodeURIComponent(description)}&timestamp=${timestamp}`;
    const signature = binanceSignature(queryString, timestamp);
    const response = await axios.post(`${BINANCE_API_URL}/api/v3/order`, { amount: amount.toString(), currency, merchantId: BINANCE_MERCHANT_ID, description, timestamp }, { headers: { 'Content-Type': 'application/json', 'BinancePay-Signature': signature, 'BinancePay-API-Key': BINANCE_API_KEY } });
    return response.data;
}

async function checkPaymentStatus(orderId) {
    const timestamp = Date.now();
    const queryString = `orderId=${orderId}&timestamp=${timestamp}`;
    const signature = binanceSignature(queryString, timestamp);
    const response = await axios.get(`${BINANCE_API_URL}/api/v3/order?orderId=${orderId}&timestamp=${timestamp}`, { headers: { 'BinancePay-Signature': signature, 'BinancePay-API-Key': BINANCE_API_KEY } });
    return response.data;
}

router.post('/create', paymentLimiter, verifyAccessToken, async (req, res) => {
    try {
        const { amount, currency = 'USDT' } = sanitizeObject(req.body);
        const userId = req.user.userId;
        if (!amount || amount < 1) return res.status(400).json({ error: 'Minimum amount is 1 USDT' });
        const credits = Math.floor(amount * 10);
        const payment = new Payment({ userId, amount, currency, credits, status: 'pending', paymentMethod: 'binance' });
        await payment.save();
        let qrCode = null, checkoutUrl = null;
        if (BINANCE_MERCHANT_ID && BINANCE_API_KEY) {
            try {
                const binanceOrder = await createBinanceOrder(amount, currency, `Puzzle Game: ${credits} Credits`);
                payment.binanceOrderId = binanceOrder.data.orderId;
                await payment.save();
                qrCode = binanceOrder.data.qrCode;
                checkoutUrl = binanceOrder.data.checkoutUrl;
            } catch (err) { console.log('Binance not available'); }
        }
        logActivity(userId, 'payment_created', { amount, credits });
        res.json({ success: true, paymentId: payment._id, amount, currency, credits, qrCode, checkoutUrl, instructions: !checkoutUrl ? { address: process.env.PAYMENT_ADDRESS, network: 'TRC20', note: `Payment-${payment._id}` } : null, expiresAt: new Date(Date.now() + 30 * 60 * 1000) });
    } catch (error) { res.status(500).json({ error: 'Failed to create payment' }); }
});

router.post('/webhook', async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const payment = await Payment.findOne({ binanceOrderId: orderId });
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        if (status === 'PAID' || status === 'COMPLETED') {
            payment.status = 'completed';
            payment.paidAt = new Date();
            await payment.save();
            const user = await User.findById(payment.userId);
            if (user) { user.freeCredits += payment.credits; await user.save(); logActivity(user._id, 'payment_completed', { credits: payment.credits }); }
        }
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Webhook failed' }); }
});

router.get('/status/:paymentId', verifyAccessToken, async (req, res) => {
    try {
        const payment = await Payment.findOne({ _id: req.params.paymentId, userId: req.user.userId });
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        if (payment.binanceOrderId && payment.status === 'pending') {
            try {
                const status = await checkPaymentStatus(payment.binanceOrderId);
                if (status.data.status === 'PAID') {
                    payment.status = 'completed';
                    payment.paidAt = new Date();
                    await payment.save();
                    const user = await User.findById(req.user.userId);
                    user.freeCredits += payment.credits;
                    await user.save();
                }
            } catch (err) {}
        }
        res.json({ paymentId: payment._id, status: payment.status, amount: payment.amount, credits: payment.credits, createdAt: payment.createdAt });
    } catch (error) { res.status(500).json({ error: 'Failed to get status' }); }
});

router.get('/history', verifyAccessToken, async (req, res) => {
    try {
        const payments = await Payment.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(20);
        res.json({ payments });
    } catch (error) { res.status(500).json({ error: 'Failed to get history' }); }
});

router.post('/verify-manual', verifyAccessToken, async (req, res) => {
    try {
        const { paymentId, txHash } = sanitizeObject(req.body);
        const payment = await Payment.findOne({ _id: paymentId, userId: req.user.userId });
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        payment.txHash = txHash;
        payment.status = 'pending_verification';
        await payment.save();
        res.json({ success: true, message: 'Payment submitted for verification (10-30 min)' });
    } catch (error) { res.status(500).json({ error: 'Failed to verify' }); }
});

module.exports = router;