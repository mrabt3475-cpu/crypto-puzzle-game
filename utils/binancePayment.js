/**
 * Binance Payment Utility
 * Handles crypto payments via Binance API
 */

const crypto = require('crypto');

class BinancePayment {
  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY || '';
    this.apiSecret = process.env.BINANCE_API_SECRET || '';
    this.walletAddress = process.env.BINANCE_WALLET_ADDRESS || '';
    this.network = process.env.BINANCE_NETWORK || 'TRC20'; // TRC20, ERC20, BEP20
    
    // Demo wallet addresses for different networks
    this.demoAddresses = {
      TRC20: 'TXmNr7w8mK7xT3QqM8s2nJ4vP6yX9zA1B',
      ERC20: '0x742d35Cc6634C0532925a3b844Bc9e7595f0fE12',
      BEP20: '0x742d35Cc6634C0532925a3b844Bc9e7595f0fE12'
    };
  }

  // Generate payment address for user
  async generatePaymentAddress(userId, level) {
    // In production, this would call Binance API to create a deposit address
    // For demo, we generate a unique address based on userId
    
    const timestamp = Date.now();
    const hash = crypto.createHash('sha256').update(userId + timestamp).digest('hex');
    
    // Generate address based on network
    const baseAddress = this.demoAddresses[this.network] || this.demoAddresses.TRC20;
    const uniquePart = hash.substring(0, 8).toUpperCase();
    
    return {
      address: `${baseAddress.substring(0, 10)}${uniquePart}${baseAddress.substring(18)}`,
      network: this.network,
      currency: 'USDT',
      memo: hash.substring(8, 16), // For TRC20
      qrCode: `trc20:${baseAddress}?memo=${hash.substring(8, 16)}`,
      expiresAt: Date.now() + (15 * 60 * 1000), // 15 minutes
      amount: this.getLevelPrice(level),
      level
    };
  }

  // Get price for level
  getLevelPrice(level) {
    const prices = {
      4: 0.5, 5: 0.5, 6: 0.5,
      7: 1, 8: 1, 9: 1, 10: 1,
      11: 2, 12: 2, 13: 2,
      14: 3, 15: 3, 16: 3,
      17: 4, 18: 4, 19: 4,
      20: 5, 21: 5, 22: 5,
      23: 6, 24: 6, 25: 7,
      26: 7, 27: 8, 28: 8,
      29: 10, 30: 15
    };
    return prices[level] || 1;
  }

  // Verify payment (simulated)
  async verifyPayment(paymentDetails) {
    // In production, this would call Binance API to check transaction
    // For demo, we simulate verification
    
    const { txHash, amount, userId, level } = paymentDetails;
    
    // Simulate network delay
    await this.delay(1000);
    
    // In production, verify via blockchain explorer API
    // For demo, accept any valid-looking tx hash
    if (!txHash || txHash.length < 10) {
      return {
        success: false,
        message: 'Invalid transaction hash'
      };
    }

    // Simulate successful verification (in production, check actual blockchain)
    const expectedAmount = this.getLevelPrice(level);
    if (amount >= expectedAmount) {
      return {
        success: true,
        message: 'Payment verified successfully',
        txHash,
        amount,
        confirmedAt: Date.now()
      };
    }

    return {
      success: false,
      message: `Amount too low. Expected: ${expectedAmount} USDT`
    };
  }

  // Get wallet address (for deposits)
  getWalletAddress() {
    return {
      address: this.demoAddresses[this.network],
      network: this.network,
      currency: 'USDT',
      qrCode: `trc20:${this.demoAddresses[this.network]}`
    };
  }

  // Create payment invoice
  async createInvoice(userId, level) {
    const price = this.getLevelPrice(level);
    const paymentAddress = await this.generatePaymentAddress(userId, level);
    
    return {
      invoiceId: 'INV_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      userId,
      level,
      amount: price,
      currency: 'USDT',
      network: this.network,
      address: paymentAddress.address,
      memo: paymentAddress.memo,
      qrCode: paymentAddress.qrCode,
      expiresAt: paymentAddress.expiresAt,
      instructions: this.getPaymentInstructions(this.network)
    };
  }

  // Get payment instructions
  getPaymentInstructions(network) {
    const instructions = {
      TRC20: [
        '1. افتح محفظة USDT (Trust Wallet, MetaMask, etc.)',
        '2. اختر إيداع USDT على شبكة TRON (TRC20)',
        '3. انسخ العنوان أدناه',
        '4. أرسل المبلغ المطلوب',
        '5. أدخل memo إذا طُلب (مهم!)',
        '6. انتظر التأكيد (يستغرق 1-2 دقيقة)'
      ],
      ERC20: [
        '1. افتح محفظة ETH/MetaMask',
        '2. أضف USDT كـ token إذا لم يكن موجوداً',
        '3. اختر إيداع USDT على شبكة Ethereum',
        '4. انسخ العنوان وأرسل المبلغ',
        '5. انتظر التأكيد (يستغرق 5-15 دقيقة)'
      ],
      BEP20: [
        '1. افتح محفظة BSC (MetaMask مع شبكة BSC)',
        '2. أضف USDT كـ token على BSC',
        '3. اختر إيداع USDT على شبكة BNB Smart Chain',
        '4. انسخ العنوان وأرسل المبلغ',
        '5. انتظر التأكيد (يستغرق 1-5 دقائق)'
      ]
    };
    
    return instructions[network] || instructions.TRC20;
  }

  // Check payment status
  async checkPaymentStatus(invoiceId) {
    // In production, check via blockchain API
    // For demo, return pending
    return {
      invoiceId,
      status: 'PENDING',
      message: 'Waiting for payment confirmation'
    };
  }

  // Helper function for delay
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get supported networks
  getSupportedNetworks() {
    return [
      { id: 'TRC20', name: 'TRON', symbol: 'TRX', fees: '~1 USDT' },
      { id: 'ERC20', name: 'Ethereum', symbol: 'ETH', fees: '~$5-10' },
      { id: 'BEP20', name: 'BNB Chain', symbol: 'BNB', fees: '~$0.5' }
    ];
  }

  // Calculate total cost for levels
  calculateTotal(levels) {
    let total = 0;
    for (const level of levels) {
      total += this.getLevelPrice(level);
    }
    return total;
  }
}

module.exports = BinancePayment;
