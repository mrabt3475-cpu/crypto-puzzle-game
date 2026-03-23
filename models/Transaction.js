/**
 * 💰 Transaction Model
 * MongoDB schema for payment transactions
 */

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    paymentId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'USDT'
    },
    network: {
        type: String,
        enum: ['TRC20', 'ERC20', 'BEP20'],
        required: true
    },
    depositAddress: {
        type: String,
        required: true
    },
    txHash: {
        type: String,
        sparse: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'expired'],
        default: 'pending'
    },
    confirmations: {
        type: Number,
        default: 0
    },
    requiredConfirmations: {
        type: Number,
        default: 1
    },
    expiresAt: {
        type: Date,
        required: true
    },
    completedAt: {
        type: Date
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Index for efficient queries
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 * 24 }); // Auto-delete after 24h for pending

// Static methods
transactionSchema.statics.createPayment = async function(data) {
    return this.create({
        ...data,
        paymentId: data.paymentId || require('uuid').v4()
    });
};

transactionSchema.statics.hasCompletedPayment = asynf function(userId) {
    const completed = await this.findOne({
        userId,
        status: 'completed',
        completedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    });
    return !!completed;
};

transactionSchema.statics.updateStatus = async function(paymentId, status, txHash = null) {
    const update = { status };
    if (txHash) update.txHash = txHash;
    if (status === 'completed') update.completedAt = new Date();

    return this.findOneAndUpdate(
        { paymentId },
        { $set: update },
        { new: true }
    );
};

// Instance methods
transactionSchema.methods.isExpired = function() {
    return this.status === 'pending' && new Date() > this.expiresAt;
};

transactionSchema.methods.canComplete = function() {
    return this.confirmations >= this.requiredConfirmations;
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
