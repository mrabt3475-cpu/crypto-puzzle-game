const mongoose = require('mongoose');
const paymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['USDT', 'TON', 'BTC', 'ETH'], default: 'USDT' },
    credits: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'pending_verification', 'completed', 'failed', 'cancelled'], default: 'pending', index: true },
    paymentMethod: { type: String, enum: ['binance', 'manual', 'ton', 'wallet'], default: 'binance' },
    binanceOrderId: { type: String, sparse: true },
    txHash: { type: String, sparse: true },
    paidAt: { type: Date },
    completedAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.methods.markCompleted = async function() {
    this.status = 'completed';
    this.paidAt = new Date();
    this.completedAt = new Date();
    return this.save();
};
module.exports = mongoose.model('Payment', paymentSchema);