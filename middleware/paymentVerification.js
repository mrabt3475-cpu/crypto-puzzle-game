/**
 * 💰 Payment Verification Middleware
 * Verify payment before allowing game access
 */

const PaymentModel = require('../models/Payment');

const verifyPayment = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Check for completed payments
        const hasValidPayment = await PaymentModel.hasCompletedPayment(userId);

        if (!hasValidPayment) {
            return res.status(403).json({
                success: false,
                error: 'Payment required',
                code: 'PAYMENT_REQUIRED'
            });
        }

        next();
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Payment verification failed'
        });
    }
};

module.exports = { verifyPayment };
