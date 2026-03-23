/**
 * 💰 Level-Based Payment System
 * Payment required at level 10 (0.01$ USDT)
 */

const binancePayment = require('./binancePayment');

class LevelPaymentSystem {
    constructor() {
        // Payment required at level 10
        this.PAYMENT_REQUIRED_LEVEL = 10;
        this.PAYMENT_AMOUNT_USDT = 0.01;

        // Gas/Transaction fees
        this.GAS_FEES = {
            TRC20: 1,      // 1 USDT network fee
            ERC20: 5,      // 5 USDT network fee
            BEP20: 0.5     // 0.5 USDT network fee
        };

        // Free levels before payment
        this.FREE_LEVELS = 9;
    }

    /**
     * Check if payment is required for a level
     * @param {number} currentLevel - Current user level
     * @returns {boolean}
     */
    isPaymentRequired(currentLevel) {
        return currentLevel === this.PAYMENT_REQUIRED_LEVEL;
    }

    /**
     * Check if user can access a level without payment
     * @param {number} level - Level to check
     * @returns {boolean}
     */
    isLevelFree(level) {
        return level <= this.FREE_LEVELS;
    }

    /**
     * Calculate total payment with gas fees
     * @param {string} network - Network type (TRC20, ERC20, BEP20)
     * @returns {object} Total amount breakdown
     */
    calculatePaymentWithGas(network) {
        const gasFee = this.GAS_FEES[network] || this.GAS_FEES.TRC20;
        const gameFee = this.PAYMENT_AMOUNT_USDT;
        const total = gameFee + gasFee;

        return {
            gameFee: gameFee,
            gasFee: gasFee,
            total: total,
            currency: 'USDT',
            network: network,
            breakdown: `Game Fee: $${gameFee} + Network Gas: $${gasFee} = $${total}`
        };
    }

    /**
     * Create payment invoice for level 10
     * @param {string} userId - User ID
     * @param {string} network - Network type
     * @returns {object} Payment details
     */
    async createLevelPayment(userId, network = 'TRC20') {
        const paymentDetails = this.calculatePaymentWithGas(network);

        // Create invoice via Binance
        const invoice = await binancePayment.createInvoice(
            paymentDetails.total,
            network,
            userId
        );

        return {
            success: invoice.success,
            level: this.PAYMENT_REQUIRED_LEVEL,
            paymentId: invoice.paymentId,
            amount: paymentDetails,
            depositAddress: invoice.depositAddress,
            qrCode: invoice.qrCode,
            expiresAt: invoice.expiresAt,
            instructions: invoice.instructions,
            message: `Payment of $${paymentDetails.total} required to unlock Level ${this.PAYMENT_REQUIRED_LEVEL}`
        };
    }

    /**
     * Verify if user has paid for level 10
     * @param {string} userId - User ID
     * @returns {Promise<boolean>}
     */
    async hasUserPaid(userId) {
        // Check in database if user has completed payment
        // const payment = await Transaction.findOne({ 
        //     userId, 
        //     status: 'completed',
        //     level: this.PAYMENT_REQUIRED_LEVEL 
        // });
        // return !!payment;

        // For now, return false (implement with actual DB check)
        return false;
    }

    /**
     * Get available networks with gas fees
     * @returns {array} Networks with fees
     */
    getAvailableNetworks() {
        return [
            { 
                id: 'TRC20', 
                name: 'TRON (TRC20)', 
                gasFee: this.GAS_FEES.TRC20,
                recommended: true,
                description: 'Cheapest fees, fast confirmation'
            },
            { 
                id: 'ERC20', 
                name: 'Ethereum (ERC20)', 
                gasFee: this.GAS_FEES.ERC20,
                recommended: false,
                description: 'Higher fees, most secure'
            },
            { 
                id: 'BEP20', 
                name: 'BNB Chain (BEP20)', 
                gasFee: this.GAS_FEES.BEP20,
                recommended: false,
                description: 'Low fees, fast on BNB Chain'
            }
        ];
    }

    /**
     * Get user progress and payment status
     * @param {object} user - User object
     * @returns {object} Progress info
     */
    getUserProgress(user) {
        const currentLevel = user.currentLevel || 1;
        const levelsRemaining = Math.max(0, this.PAYMENT_REQUIRED_LEVEL - currentLevel);
        const isPaymentRequired = this.isPaymentRequired(currentLevel);
        const isLevelFree = this.isLevelFree(currentLevel);

        return {
            currentLevel,
            totalLevels: 20,
            paymentRequiredLevel: this.PAYMENT_REQUIRED_LEVEL,
            isPaymentRequired,
            isLevelFree,
            levelsUntilPayment: levelsRemaining,
            paymentAmount: this.PAYMENT_AMOUNT_USDT,
            gasFees: this.GAS_FEES,
            message: isPaymentRequired 
                ? `Level ${this.PAYMENT_REQUIRED_LEVEL} requires payment of $${this.PAYMENT_AMOUNT_USDT} + gas fees`
                : isLevelFree
                    ? `${levelsRemaining} free levels remaining`
                    : 'Payment already completed'
        };
    }
}

module.exports = new LevelPaymentSystem();
