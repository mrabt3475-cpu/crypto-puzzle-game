const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  // نظام الألغاز
  puzzles: {
    type: Array,
    default: []
  },
  puzzlesSolved: {
    type: Number,
    default: 0
  },
  level: {
    type: Number,
    default: 1
  },
  // الرصيد المجاني
  freeCredits: {
    type: Number,
    default: 10 // 10 محاولات مجانية
  },
  // الرصيد المدفوع
  paidCredits: {
    type: Number,
    default: 0
  },
  // المحفظة
  balance: {
    type: Number,
    default: 0
  },
  totalScore: {
    type: Number,
    default: 0
  },
  // نظام الاشتراك
  isPremium: {
    type: Boolean,
    default: false
  },
  premiumExpires: {
    type: Date,
    default: null
  },
  // الإحصائيات
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
});

// حساب الرصيد الإجمالي
UserSchema.virtual('totalCredits').get(function() {
  return this.freeCredits + this.paidCredits;
});

// التحقق من الاشتراك المميز
UserSchema.methods.isPremiumActive = function() {
  if (!this.isPremium) return false;
  if (!this.premiumExpires) return true;
  return new Date() < this.premiumExpires;
};

module.exports = mongoose.model('User', UserSchema);
