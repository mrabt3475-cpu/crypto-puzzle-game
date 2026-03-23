const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { verifyAccessToken, paymentLimiter, sanitizeObject, logActivity } = require('../middleware/security');
const { verifyUSDTTransaction } = require('../middleware/anticheat');

const BINANCE_API_URL = 'https://binancepay.binance.com';
const BINANCE_MERCHANT_ID = process.env.BINANCE_MERCHANT_ID;
const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET;
const PAYMENT_WALLET = process.env.PAYMENT_WALLET;

const CREDIT_PACKAGES = [
    { id: 'starter', credits: 10, price: 1, bonus: 0 },
    { id: 'basic', credits: 50, price: 5, bonus: 5 },
    { id: 'pro', credits: 150, price: 15, bonus: 25 },
    { id: 'premium', credits: 500, price: 50, bonus: 100 },
    { id: 'vip', credits: 1500, price: 150, bonus: 500 }
];

function binanceSignature(queryString, timestamp) {
    const message = timestamp + '\n' + queryString;
    return crypto.createHmac('sha256', BINANCE_API_SECRET).update(message).digest('hex');
}

async function createBinanceOrder(amount, currency, description) {
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

router.get('/packages', (req, res) => { res.json({ packages: CREDIT_PACKAGES.map(p => ({ id: p.id, credits: p.credits + p.bonus, price: p.price, bonus: p.bonus })) }); });

router.post('/create', paymentLimiter, verifyAccessToken, async (req, res) => {
    try {
        const { packageId, currency = 'USDT' } = sanitizeObject(req.body);
        const userId = req.user.userId;
        const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
        if (!pkg) return res.status(400).json({ error: 'Invalid package' });
        const credits = pkg.credits + pkg.bonus;
        const payment = new Payment({ userId, amount: pkg.price, currency, credits, status: 'pending', paymentMethod: 'binance', metadata: { packageId, bonus: pkg.bonus } });
        await payment.save();
        let qrCode = null, checkoutUrl = null;
        if (BINANCE_MERCHANT_ID && BINANCE_API_KEY && BINANCE_API_SECRET) {
            try {
                const binanceOrder = await createBinanceOrder(pkg.price, currency, `Puzzle Game: ${credits} Credits`);
                payment.binanceOrderId = binanceOrder.data.orderId;
                await payment.save();
                qrCode = binanceOrder.data.qrCode;
                checkoutUrl = binanceOrder.data.checkoutUrl;
            } catch (err) { console.log('Binance not available'); }
        }
        logActivity(userId, 'payment_created', { packageId, credits, amount: pkg.price });
        res.json({ success: true, paymentId: payment._id, amount: pkg.price, currency, credits, qrCode, checkoutUrl, manualPayment: !checkoutUrl ? { address: PAYMENT_WALLET, network: 'TRC20 (TRON)', amount: pkg.price, memo: `PAY-${payment._id}`, instructions: 'Send exact amount. Verified automatically in 10-30 min.' } : null, expiresAt: new Date(Date.now() + 30 * 60 * 1000) });
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
            if (user) { user.purchasedCredits += payment.credits; await user.save(); logActivity(user._id, 'payment_completed', { credits: payment.credits }); }
        }
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Webhook failed' }); }
});

router.post('/verify-manual', verifyAccessToken, async (req, res) => {
    try {
        const { paymentId, txHash } = sanitizeObject(req.body);
        const userId = req.user.userId;
        const payment = await Payment.findOne({ _id: paymentId, userId });
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        if (payment.status === 'completed') return res.json({ success: true, message: 'Payment already verified' });
        const verification = await verifyUSDTTransaction(txHash, PAYMENT_WALLET);
        if (verification.valid && verification.confirmed) {
            payment.status = 'completed';
            payment.txHash = txHash;
            payment.paidAt = new Date();
            await payment.save();
            const user = await User.findById(userId);
            user.purchasedCredits += payment.credits;
            await user.save();
            logActivity(userId, 'payment_verified', { credits: payment.credits, txHash });
            res.json({ success: true, message: 'Payment verified! Credits added.', credits: payment.credits });
        } else {
            payment.txHash = txHash;
            payment.status = 'pending_verification';
            await payment.save();
            res.json({ success: false, message: verification.reason || 'Verification pending (10-30 min)', status: 'pending_verification' });
        }
    } catch (error) { res.status(500).json({ error: 'Verification failed' }); }
});

router.get('/status/:paymentId', verifyAccessToken, async (req, res) => {
    try {
        const payment = await Payment.findOne({ _id: req.params.paymentId, userId: req.user.userId });
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        if (payment.binanceOrderId && payment.status === 'pending') {
            try {
                const status = await checkPaymentStatus(payment.binanceOrderId);
                if (status.data?.status === 'PAID') {
                    payment.status = 'completed';
                    payment.paidAt = new Date();
                    await payment.save();
                    const user = await User.findById(req.user.userId);
                    user.purchasedCredits += payment.credits;
                    await user.save();
                }
            } catch (err) {}
        }
        res.json({ paymentId: payment._id, status: payment.status, amount: payment.amount, credits: payment.credits, createdAt: payment.createdAt, paidAt: payment.paidAt });
    } catch (error) { res.status(500).json({ error: 'Failed to get status' }); }
});

router.get('/history', verifyAccessToken, async (req, res) => {
    try {
        const payments = await Payment.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(20);
        res.json({ payments });
    } catch (error) { res.status(500).json({ error: 'Failed to get history' }); }
});

module.exports = router;