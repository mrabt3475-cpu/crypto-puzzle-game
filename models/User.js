const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30, index: true },
    password: { type: String, required: true, minlength: 8 },
    role: { type: String, enum: ['user', 'admin', 'moderator'], default: 'user' },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    freeCredits: { type: Number, default: 10, min: 0 },
    purchasedCredits: { type: Number, default: 0, min: 0 },
    currentLevel: { type: Number, default: 1, min: 1 },
    completedPuzzles: { type: Number, default: 0, min: 0 },
    totalPoints: { type: Number, default: 0, min: 0 },
    refreshToken: { type: String, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    settings: { notifications: { type: Boolean, default: true }, publicProfile: { type: Boolean, default: false }, language: { type: String, default: 'ar' } },
    lastLogin: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date }
}, { timestamps: true });
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});
userSchema.methods.comparePassword = async function(candidatePassword) { return bcrypt.compare(candidatePassword, this.password); };
userSchema.methods.isLocked = function() { return this.lockUntil && this.lockUntil > Date.now(); };
userSchema.methods.incrementLoginAttempts = async function() {
    if (this.lockUntil && this.lockUntil < Date.now()) return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
    const updates = { $inc: { loginAttempts: 1 } };
    if (this.loginAttempts + 1 >= 5) updates.$set = { lockUntil: Date.now() + 15 * 60 * 1000 };
    return this.updateOne(updates);
};
userSchema.methods.addCredits = function(amount, type = 'free') {
    if (type === 'free') this.freeCredits += amount;
    else this.purchasedCredits += amount;
    return this.save();
};
userSchema.methods.deductCredits = function(amount) {
    const total = this.freeCredits + this.purchasedCredits;
    if (total < amount) throw new Error('Insufficient credits');
    if (this.freeCredits >= amount) this.freeCredits -= amount;
    else { const remaining = amount - this.freeCredits; this.freeCredits = 0; this.purchasedCredits -= remaining; }
    return this.save();
};
userSchema.virtual('totalCredits').get(function() { return this.freeCredits + this.purchasedCredits; });
userSchema.set('toJSON', { virtuals: true, transform: function(doc, ret) { delete ret.password; delete ret.refreshToken; delete ret.passwordResetToken; delete ret.passwordResetExpires; delete ret.twoFactorSecret; delete ret.__v; return ret; } });
module.exports = mongoose.model('User', userSchema);