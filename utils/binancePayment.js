/**
 * Binance Payment Utility - Real API Integration
 * Uses Binance API for deposit addresses and payment verification
 */

const crypto = require('crypto');
const axios = require('axios');

class BinancePayment {
  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY || '';
    this.apiSecret = process.env.BINANCE_API_SECRET || '';
    this.walletAddress = process.env.BINANCE_WALLET_ADDRESS || '';
    this.network = process.env.BINANCE_NETWORK || 'TRC20'; // TRC20, ERC20, BEP20
    this.baseUrl = 'https://api.binance.com'; // Production
    // this.baseUrl = 'https://testnet.binance.vision'; // Testnet
    
    this.isConfigured = !!(this.apiKey && this.apiSecret && this.walletAddress);
  }

  // Generate signature for Binance API
  generateSignature(queryString) {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  // Make authenticated request to Binance API
  async makeRequest(method, endpoint, params = {}) {
    if (!this.isConfigured) {
      throw new Error('Binance API not configured. Add BINANCE_API_KEY and BINANCE_API_SECRET to .env');
    }

    const timestamp = Date.now();
    const queryString = new URLSearchParams({
      ...params,
      timestamp,
      recvWindow: 5000
    }).toString();

    const signature = this.generateSignature(queryString);
    const url = `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    try {
      const response = await axios({
        method,
        url,
        headers: {
          'X-MBX-APIKEY': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Binance API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get deposit address for specific network
  async getDepositAddress(coin = 'USDT', network = null) {
    // Map network names
    const networkMap = {
      'TRC20': 'TRX',
      'ERC20': 'ETH',
      'BEP20': 'BSC'
    };
    
    const networkName = networkMap[network] || networkMap[this.network];
    
    if (!this.isConfigured) {
      // Fallback to demo if not configured
      return this.getDemoAddress(networkName);
    }

    try {
      const response = await this.makeRequest(
        'GET',
        '/api/v3/capital/deposit/address',
        { coin, network: networkName }
      );
      
      return {
        address: response.address,
        memo: response.memo || null,
        network: networkName,
        coin,
        success: true
      };
    } catch (error) {
      console.error('Failed to get deposit address:', error.message);
      // Fallback to demo
      return this.getDemoAddress(networkName);
    }
  }

  // Get demo address (when API not configured)
  getDemoAddress(network) {
    const demoAddresses = {
      'TRX': 'TXmNr7w8mK7xT3QqM8s2nJ4vP6yX9zA1B',
      'ETH': '0x742d35Cc6634C0532925a3b844Bc9e7595f0fE12',
      'BSC': '0x742d35Cc6634C0532925a3b844Bc9e7595f0fE12'
    };
    
    return {
      address: demoAddresses[network] || demoAddresses.TRX,
      memo: network === 'TRX' ? '12345678' : null,
      network,
      coin: 'USDT',
      success: true,
      isDemo: true
    };
  }

  // Check deposit history
  async getDepositHistory(coin = 'USDT', startTime = null, limit = 10) {
    if (!this.isConfigured) {
      throw new Error('Binance API not configured');
    }

    const params = { coin, limit };
    if (startTime) params.startTime = startTime;

    try {
      const response = await this.makeRequest(
        'GET',
        '/api/v3/capital/deposit/hisrec',
        params
      );
      return response;
    } catch (error) {
      console.error('Failed to get deposit history:', error.message);
      throw error;
    }
  }

  // Check specific transaction by txId
  async checkTransaction(txHash, coin = 'USDT', network = null) {
    if (!this.isConfigured) {
      // Demo mode - simulate verification
      return this.verifyDemoTransaction(txHash);
    }

    const networkMap = {
      'TRC20': 'TRX',
      'ERC20': 'ETH',
      'BEP20': 'BSC'
    };
    
    const networkName = networkMap[network] || networkMap[this.network];

    try {
      // Get recent deposits and check for matching txHash
      const deposits = await this.getDepositHistory(coin, Date.now() - 3600000 * 24); // Last 24 hours
      
      const deposit = deposits.find(d => 
        d.txId === txHash || 
        d.txId.toLowerCase() === txHash.toLowerCase()
      );
      
      if (deposit) {
        return {
          success: true,
          confirmed: deposit.status === 1, // 0: pending, 1: success
          amount: parseFloat(deposit.amount),
          txHash: deposit.txId,
          network: deposit.network,
          confirmations: deposit.confirmTimes?.split('/')[0] || '0'
        };
      }
      
      return {
        success: false,
        message: 'Transaction not found in deposit history'
      };
    } catch (error) {
      console.error('Failed to check transaction:', error.message);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Demo transaction verification
  verifyDemoTransaction(txHash) {
    // Accept any txHash that looks valid (64 hex characters)
    const isValid = /^[a-fA-F0-9]{64}$/.test(txHash);
    
    return {
      success: isValid,
      confirmed: isValid,
      message: isValid ? 'Demo: Transaction verified' : 'Invalid transaction hash',
      isDemo: true
    };
  }

  // Generate payment address for user
  async generatePaymentAddress(userId, level) {
    const networkMap = {
      'TRC20': 'TRX',
      'ERC20': 'ETH',
      'BEP20': 'BSC'
    };
    
    const networkName = networkMap[this.network];
    
    // Get real or demo address
    const depositInfo = await this.getDepositAddress('USDT', this.network);
    
    // Generate unique memo for TRC20 (required)
    const memo = depositInfo.memo || crypto.createHash('md5').update(userId + level).digest('hex').substring(0, 8);
    
    return {
      address: depositInfo.address,
      network: this.network,
      networkName,
      currency: 'USDT',
      memo: memo,
      qrCode: `trc20:${depositInfo.address}?memo=${memo}`,
      expiresAt: Date.now() + (15 * 60 * 1000), // 15 minutes
      amount: this.getLevelPrice(level),
      level,
      isDemo: depositInfo.isDemo || false
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

  // Verify payment with real Binance API
  async verifyPayment(paymentDetails) {
    const { txHash, amount, userId, level } = paymentDetails;
    const expectedAmount = this.getLevelPrice(level);
    
    // Check transaction on blockchain
    const txInfo = await this.checkTransaction(txHash, 'USDT', this.network);
    
    if (!txInfo.success) {
      return {
        success: false,
        message: txInfo.message || 'Transaction not found'
      };
    }
    
    // Check if confirmed
    if (!txInfo.confirmed) {
      return {
        success: false,
        message: 'Transaction not confirmed yet'
      };
    }
    
    // Check amount
    if (txInfo.amount < expectedAmount) {
      return {
        success: false,
        message: `Amount too low. Expected: ${expectedAmount} USDT, Received: ${txInfo.amount} USDT`
      };
    }
    
    return {
      success: true,
      message: 'Payment verified successfully',
      txHash,
      amount: txInfo.amount,
      confirmedAt: Date.now(),
      confirmations: txInfo.confirmations
    };
  }

  // Get wallet address (for deposits)
  getWalletAddress() {
    return {
      address: this.walletAddress,
      network: this.network,
      currency: 'USDT',
      qrCode: `trc20:${this.walletAddress}`
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
      instructions: this.getPaymentInstructions(this.network),
      isDemo: paymentAddress.isDemo || false
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
    // In production, check via Binance API
    return {
      invoiceId,
      status: 'PENDING',
      message: 'Waiting for payment confirmation'
    };
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

  // Check if API is configured
  isApiConfigured() {
    return this.isConfigured;
  }
}

module.exports = BinancePayment;
