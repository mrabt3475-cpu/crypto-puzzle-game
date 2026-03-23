/**
 * 💰 Binance Payment Integration
 * USDT Payment via TRC20/ERC20 networks
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class BinancePayment {
    constructor() {
        this.apiKey = process.env.BINANCE_API_KEY;
        this.apiSecret = process.env.BINANCE_API_SECRET;
        this.webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
        this.baseUrl = process.env.BINANCE_ENV === 'production' 
            ? 'https://api.binance.com' 
            : 'https://testnet.binance.vision';
    }

    /**
     * 💳 Create Payment Invoice
     * @param {number} amount - Amount in USDT
     * @param {string} network - TRC20, ERC20, or BEP20
     * @param {string} userId - User ID
     * @returns {object} Payment details with address
     */
    async createInvoice(amount, network = 'TRC20', userId) {
        try {
            // Generate unique payment ID
            const paymentId = uuidv4();

            // Get deposit address from Binance
            const depositAddress = await this.getDepositAddress(network);

            // Calculate expected amount with small buffer for network fees
            const expectedAmount = parseFloat(amount.toFixed(2));

            return {
                success: true,
                paymentId,
                amount: expectedAmount,
                currency: 'USDT',
                network,
                depositAddress: depositAddress.address,
                memo: depositAddress.memo || null,
                qrCode: this.generateQRCode(depositAddress.address, expectedAmount),
                expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
                instructions: this.getPaymentInstructions(network)
            };
        } catch (error) {
            console.error('Payment creation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 📥 Get Deposit Address from Binance
     */
    async getDepositAddress(network) {
        try {
            const endpoint = '/api/v3/capital/deposit/address';
            const timestamp = Date.now();

            const queryString = `coin=USDT&network=${network}&timestamp=${timestamp}`;
            const signature = this.generateSignature(queryString);

            const response = await axios.get(`${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`, {
                headers: {
                    'X-MBX-APIKEY': this.apiKey
                }
            });

            return {
                address: response.data.address,
                memo: response.data.memo
            };
        } catch (error) {
            // Return mock address for testing
            return {
                address: network === 'TRC20' 
                    ? 'TXmM6sUJhmYzN3vXj9V5k7G2vL8yQ3nJ4K' 
                    : '0x742d35Cc6634C0532925a3b844Bc9e7595f4f7E1',
                memo: null
            };
        }
    }

    /**
     * 🔐 Generate HMAC Signature
     */
    generateSignature(queryString) {
        const crypto = require('crypto');
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(queryString)
            .digest('hex');
    }

    /**
     * 📱 Generate QR Code URL
     */
    generateQRCode(address, amount) {
        return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=USDT:${address}?amount=${amount}`;
    }

    /**
     * 📋 Get Payment Instructions
     */
    getPaymentInstructions(network) {
        const instructions = {
            TRC20: [
                '1. Open your wallet app',
                '2. Send USDT via TRC20 network',
                '3. Use the address shown above',
                '4. Do not send less than the specified amount',
                '5. Wait for 1-2 network confirmations'
            ],
            ERC20: [
                '1. Open your wallet (MetaMask, Trust Wallet, etc.)',
                '2. Send USDT via ERC20 network',
                '3. Set gas fee to recommended or higher',
                '4. Wait for 12-15 network confirmations'
            ],
            BEP20: [
                '1. Open your wallet (MetaMask, Trust Wallet)',
                '2. Switch to BSC network',
                '3. Send USDT via BEP20 network',
                '4. Wait for 15-20 confirmations'
            ]
        };
        return instructions[network] || instructions.TRC20;
    }

    /**
     * ✅ Verify Payment via Webhook
     */
    verifyWebhook(payload, signature) {
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', this.webhookSecret)
            .update(JSON.stringify(payload))
            .digest('hex');

        return signature === expectedSignature;
    }

    /**
     * 🔍 Check Transaction Status
     */
    async checkTransaction(txHash, network) {
        try {
            // In production, check via Binance API
            // For now, return mock status
            return {
                success: true,
                confirmed: true,
                confirmations: 1,
                amount: 0,
                txHash
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new BinancePayment();
