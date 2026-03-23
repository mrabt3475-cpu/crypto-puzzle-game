/**
 * Payment Model - Level-based payment system with Binance
 */

const crypto = require('crypto');

class Payment {
  constructor() {
    this.payments = new Map();
  }

  // Generate unique payment ID
  generatePaymentId() {
    return 'PAY_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  // Create new payment
  createPayment(userId, level, amount, currency = 'USDT') {
    const paymentId = this.generatePaymentId();
    const payment = {
      paymentId,
      userId,
      level,
      amount,
      currency,
      status: 'PENDING',
      createdAt: Date.now(),
      expiresAt: Date.now() + (15 * 60 * 1000), // 15 minutes expiry
      confirmedAt: null,
      txHash: null,
      network: 'TRC20' // Default network
    };
    
    this.payments.set(paymentId, payment);
    return payment;
  }

  // Get payment by ID
  getPayment(paymentId) {
    return this.payments.get(paymentId) || null;
  }

  // Get payment by user and level
  getPaymentByUserAndLevel(userId, level) {
    for (const payment of this.payments.values()) {
      if (payment.userId === userId && payment.level === level && payment.status === 'PENDING') {
        if (Date.now() < payment.expiresAt) {
          return payment;
        }
      }
    }
    return null;
  }

  // Update payment status
  updatePaymentStatus(paymentId, status, txHash = null) {
    const payment = this.payments.get(paymentId);
    if (!payment) return null;

    payment.status = status;
    if (txHash) payment.txHash = txHash;
    if (status === 'CONFIRMED') {
      payment.confirmedAt = Date.now();
    }

    this.payments.set(paymentId, payment);
    return payment;
  }

  // Check if level is paid
  isLevelPaid(userId, level) {
    for (const payment of this.payments.values()) {
      if (payment.userId === userId && 
          payment.level === level && 
          payment.status === 'CONFIRMED') {
        return true;
      }
    }
    return false;
  }

  // Get all payments for user
  getUserPayments(userId) {
    const userPayments = [];
    for (const payment of this.payments.values()) {
      if (payment.userId === userId) {
        userPayments.push(payment);
      }
    }
    return userPayments.sort((a, b) => b.createdAt - a.createdAt);
  }

  // Clean expired payments
  cleanExpiredPayments() {
    const now = Date.now();
    for (const [paymentId, payment] of this.payments.entries()) {
      if (payment.status === 'PENDING' && now > payment.expiresAt) {
        payment.status = 'EXPIRED';
        this.payments.set(paymentId, payment);
      }
    }
  }
}

// Level pricing configuration
const LEVEL_PRICING = {
  // Free levels (1-3)
  1: { price: 0, currency: 'USDT' },
  2: { price: 0, currency: 'USDT' },
  3: { price: 0, currency: 'USDT' },
  
  // Cheap levels (4-10)
  4: { price: 0.5, currency: 'USDT' },
  5: { price: 0.5, currency: 'USDT' },
  6: { price: 0.5, currency: 'USDT' },
  7: { price: 1, currency: 'USDT' },
  8: { price: 1, currency: 'USDT' },
  9: { price: 1, currency: 'USDT' },
  10: { price: 1, currency: 'USDT' },
  
  // Medium levels (11-20)
  11: { price: 2, currency: 'USDT' },
  12: { price: 2, currency: 'USDT' },
  13: { price: 2, currency: 'USDT' },
  14: { price: 3, currency: 'USDT' },
  15: { price: 3, currency: 'USDT' },
  16: { price: 3, currency: 'USDT' },
  17: { price: 4, currency: 'USDT' },
  18: { price: 4, currency: 'USDT' },
  19: { price: 4, currency: 'USDT' },
  20: { price: 5, currency: 'USDT' },
  
  // Expert levels (21-30)
  21: { price: 5, currency: 'USDT' },
  22: { price: 5, currency: 'USDT' },
  23: { price: 6, currency: 'USDT' },
  24: { price: 6, currency: 'USDT' },
  25: { price: 7, currency: 'USDT' },
  26: { price: 7, currency: 'USDT' },
  27: { price: 8, currency: 'USDT' },
  28: { price: 8, currency: 'USDT' },
  29: { price: 10, currency: 'USDT' },
  30: { price: 15, currency: 'USDT' }
};

// Get price for level
function getLevelPrice(level) {
  return LEVEL_PRICING[level] || { price: 1, currency: 'USDT' };
}

// Check if level requires payment
function requiresPayment(level) {
  const pricing = getLevelPrice(level);
  return pricing.price > 0;
}

// Get all paid levels
function getPaidLevels() {
  return Object.entries(LEVEL_PRICING)
    .filter(([_, pricing]) => pricing.price > 0)
    .map(([level, _]) => parseInt(level));
}

// Calculate total price for multiple levels
function calculateTotalPrice(levels) {
  let total = 0;
  for (const level of levels) {
    total += getLevelPrice(level).price;
  }
  return total;
}

module.exports = {
  Payment,
  LEVEL_PRICING,
  getLevelPrice,
  requiresPayment,
  getPaidLevels,
  calculateTotalPrice
};
