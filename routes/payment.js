/**
 * Payment Routes - Level-based payment with Binance
 */

const express = require('express');
const { Payment, getLevelPrice, requiresPayment, getPaidLevels } = require('../models/Payment');
const BinancePayment = require('../utils/binancePayment');
const { rateLimiter, validateInput, securityLog } = require('../middleware/securityAdvanced');

const router = express.Router();
const paymentSystem = new Payment();
const binancePayment = new BinancePayment();

// ==================== GET LEVEL PRICE ====================
router.get('/price/:level', (req, res) => {
  try {
    const { level } = req.params;
    const levelNum = parseInt(level);
    
    if (isNaN(levelNum) || levelNum < 1 || levelNum > 30) {
      return res.status(400).json({ error: 'Invalid level (1-30)' });
    }
    
    const pricing = getLevelPrice(levelNum);
    
    res.json({
      success: true,
      level: levelNum,
      price: pricing.price,
      currency: pricing.currency,
      requiresPayment: pricing.price > 0,
      network: binancePayment.network
    });
    
  } catch (error) {
    console.error('Get price error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== GET ALL PRICING ====================
router.get('/pricing', (req, res) => {
  try {
    const pricing = {};
    for (let i = 1; i <= 30; i++) {
      const p = getLevelPrice(i);
      pricing[i] = { price: p.price, currency: p.currency, requiresPayment: p.price > 0 };
    }
    
    const total = Object.values(pricing).reduce((sum, p) => sum + p.price, 0);
    
    res.json({
      success: true,
      pricing,
      summary: {
        totalLevels: 30,
        freeLevels: 3,
        paidLevels: 27,
        totalPrice: total,
        currency: 'USDT'
      }
    });
    
  } catch (error) {
    console.error('Get pricing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== CREATE PAYMENT ====================
router.post('/create', rateLimiter, async (req, res) => {
  try {
    const { userId, level, network } = req.body;
    
    // Validate inputs
    if (!userId || !level) {
      return res.status(400).json({ error: 'Missing userId or level' });
    }
    
    const levelNum = parseInt(level);
    if (isNaN(levelNum) || levelNum < 1 || levelNum > 30) {
      return res.status(400).json({ error: 'Invalid level' });
    }
    
    // Check if level requires payment
    if (!requiresPayment(levelNum)) {
      return res.json({
        success: true,
        message: 'هذا المستوى مجاني!',
        level: levelNum,
        price: 0,
        requiresPayment: false
      });
    }
    
    // Check if already paid
    if (paymentSystem.isLevelPaid(userId, levelNum)) {
      return res.json({
        success: true,
        message: 'هذا المستوى مدفوع مسبقاً!',
        level: levelNum,
        alreadyPaid: true
      });
    }
    
    // Check for existing pending payment
    const existingPayment = paymentSystem.getPaymentByUserAndLevel(userId, levelNum);
    if (existingPayment) {
      const invoice = await binancePayment.createInvoice(userId, levelNum);
      return res.json({
        success: true,
        message: 'دفع_pending موجود',
        invoice,
        existingPayment: {
          paymentId: existingPayment.paymentId,
          status: existingPayment.status,
          expiresAt: existingPayment.expiresAt
        }
      });
    }
    
    // Create payment
    const pricing = getLevelPrice(levelNum);
    const payment = paymentSystem.createPayment(userId, levelNum, pricing.price, pricing.currency);
    
    // Generate invoice
    const invoice = await binancePayment.createInvoice(userId, levelNum);
    invoice.paymentId = payment.paymentId;
    
    securityLog('payment_created', { userId, level: levelNum, amount: pricing.price });
    
    res.json({
      success: true,
      message: 'تم إنشاء الفاتورة!',
      invoice,
      payment: {
        paymentId: payment.paymentId,
        amount: payment.amount,
        currency: payment.currency,
        expiresAt: payment.expiresAt
      }
    });
    
  } catch (error) {
    console.error('Create payment error:', error);
    securityLog('error', { error: error.message, endpoint: '/payment/create' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== VERIFY PAYMENT ====================
router.post('/verify', rateLimiter, async (req, res) => {
  try {
    const { paymentId, txHash, userId, level } = req.body;
    
    if (!paymentId || !txHash) {
      return res.status(400).json({ error: 'Missing paymentId or txHash' });
    }
    
    // Get payment
    const payment = paymentSystem.getPayment(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    if (payment.status === 'CONFIRMED') {
      return res.json({
        success: true,
        message: 'Payment already confirmed',
        payment
      });
    }
    
    if (payment.status === 'EXPIRED') {
      return res.status(400).json({ error: 'Payment expired. Please create new payment.' });
    }
    
    // Verify with Binance
    const verification = await binancePayment.verifyPayment({
      txHash,
      amount: payment.amount,
      userId: payment.userId,
      level: payment.level
    });
    
    if (verification.success) {
      paymentSystem.updatePaymentStatus(paymentId, 'CONFIRMED', txHash);
      
      securityLog('payment_confirmed', { 
        userId: payment.userId, 
        level: payment.level, 
        amount: payment.amount,
        txHash 
      });
      
      res.json({
        success: true,
        message: '✅ تم تأكيد الدفع!',
        payment: {
          paymentId,
          status: 'CONFIRMED',
          level: payment.level,
          amount: payment.amount,
          txHash,
          confirmedAt: verification.confirmedAt
        }
      });
    } else {
      paymentSystem.updatePaymentStatus(paymentId, 'FAILED');
      
      securityLog('payment_failed', { 
        userId: payment.userId, 
        level: payment.level,
        reason: verification.message 
      });
      
      res.json({
        success: false,
        message: verification.message,
        payment: {
          paymentId,
          status: 'FAILED'
        }
      });
    }
    
  } catch (error) {
    console.error('Verify payment error:', error);
    securityLog('error', { error: error.message, endpoint: '/payment/verify' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== CHECK PAYMENT STATUS ====================
router.get('/status/:paymentId', (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = paymentSystem.getPayment(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    // Check if expired
    if (payment.status === 'PENDING' && Date.now() > payment.expiresAt) {
      payment.status = 'EXPIRED';
    }
    
    res.json({
      success: true,
      payment: {
        paymentId: payment.paymentId,
        userId: payment.userId,
        level: payment.level,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        createdAt: payment.createdAt,
        expiresAt: payment.expiresAt,
        confirmedAt: payment.confirmedAt,
        txHash: payment.txHash
      }
    });
    
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== GET USER PAYMENTS ====================
router.get('/user/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    const payments = paymentSystem.getUserPayments(userId);
    
    const summary = {
      total: payments.length,
      pending: payments.filter(p => p.status === 'PENDING').length,
      confirmed: payments.filter(p => p.status === 'CONFIRMED').length,
      failed: payments.filter(p => p.status === 'FAILED').length,
      expired: payments.filter(p => p.status === 'EXPIRED').length,
      totalPaid: payments
        .filter(p => p.status === 'CONFIRMED')
        .reduce((sum, p) => sum + p.amount, 0)
    };
    
    res.json({
      success: true,
      summary,
      payments: payments.map(p => ({
        paymentId: p.paymentId,
        level: p.level,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt,
        confirmedAt: p.confirmedAt
      }))
    });
    
  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== CHECK LEVEL ACCESS ====================
router.get('/check/:userId/:level', (req, res) => {
  try {
    const { userId, level } = req.params;
    const levelNum = parseInt(level);
    
    if (isNaN(levelNum) || levelNum < 1 || levelNum > 30) {
      return res.status(400).json({ error: 'Invalid level' });
    }
    
    // Check if free
    if (!requiresPayment(levelNum)) {
      return res.json({
        success: true,
        level: levelNum,
        hasAccess: true,
        isFree: true,
        isPaid: false
      });
    }
    
    // Check if paid
    const isPaid = paymentSystem.isLevelPaid(userId, levelNum);
    const pricing = getLevelPrice(levelNum);
    
    res.json({
      success: true,
      level: levelNum,
      hasAccess: isPaid,
      isFree: false,
      isPaid,
      price: pricing.price,
      currency: pricing.currency
    });
    
  } catch (error) {
    console.error('Check level access error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== GET WALLET INFO ====================
router.get('/wallet', (req, res) => {
  try {
    const wallet = binancePayment.getWalletAddress();
    const networks = binancePayment.getSupportedNetworks();
    
    res.json({
      success: true,
      wallet,
      supportedNetworks: networks,
      currency: 'USDT'
    });
    
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== HEALTH CHECK ====================
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Payment System',
    version: '1.0',
    network: binancePayment.network,
    supportedNetworks: binancePayment.getSupportedNetworks().map(n => n.id)
  });
});

module.exports = router;
